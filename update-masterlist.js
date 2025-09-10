import { readFile, writeFile } from 'fs/promises'
import https from 'https'
import chalk from 'chalk'
import { XMLParser } from 'fast-xml-parser'

async function importJson(file) {
    return JSON.parse(await readFile(new URL(file, import.meta.url)))
}

async function fetchModVersions(gitUrl) {
    const parser = new XMLParser()
    
    // Convert git URL to raw file URL
    let rawUrl = null
    let fallbackUrl = null
    
    if (gitUrl.includes('gitgud.io')) {
        // GitGud pattern: https://gitgud.io/{user}/{repo}.git
        const urlParts = gitUrl.replace('.git', '').replace('https://', '').split('/')
        const baseUrl = `https://gitgud.io/${urlParts[1]}/${urlParts[2]}`
        rawUrl = `${baseUrl}/-/raw/master/About/About.xml`
        fallbackUrl = `${baseUrl}/-/raw/main/About/About.xml`
    } else if (gitUrl.includes('github.com')) {
        // GitHub pattern: https://github.com/{user}/{repo}.git
        const urlParts = gitUrl.replace('.git', '').replace('https://github.com/', '').split('/')
        rawUrl = `https://raw.githubusercontent.com/${urlParts[0]}/${urlParts[1]}/master/About/About.xml`
        fallbackUrl = `https://raw.githubusercontent.com/${urlParts[0]}/${urlParts[1]}/main/About/About.xml`
    } else if (gitUrl.includes('gitlab.com')) {
        // GitLab pattern: https://gitlab.com/{user}/{repo}.git
        const urlParts = gitUrl.replace('.git', '').replace('https://', '').split('/')
        const baseUrl = `https://gitlab.com/${urlParts[1]}/${urlParts[2]}`
        rawUrl = `${baseUrl}/-/raw/main/About/About.xml`
        fallbackUrl = `${baseUrl}/-/raw/master/About/About.xml`
    }
    
    if (!rawUrl) {
        throw new Error(`Unsupported git hosting platform for URL: ${gitUrl}`)
    }
    
    // Try to fetch the About.xml file
    const tryFetch = (url) => {
        return new Promise((resolve, reject) => {
            let request
            let isResolved = false
            
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true
                    if (request) {
                        request.destroy()
                    }
                    reject(new Error('Request timeout (5s)'))
                }
            }, 5000) // 5 second timeout per request
            
            request = https.get(url, (response) => {
                clearTimeout(timeout)
                
                // Handle authentication errors and redirects
                if (response.statusCode === 401 || response.statusCode === 403) {
                    if (!isResolved) {
                        isResolved = true
                        reject(new Error(`Authentication required (${response.statusCode})`))
                    }
                    return
                }
                
                // Handle redirects that might be login pages
                if (response.statusCode >= 300 && response.statusCode < 400) {
                    const redirectUrl = response.headers.location
                    if (redirectUrl && (redirectUrl.includes('login') || redirectUrl.includes('signin') || redirectUrl.includes('sign_in') || redirectUrl.includes('auth'))) {
                        if (!isResolved) {
                            isResolved = true
                            reject(new Error('Redirect to login page detected'))
                        }
                        return
                    }
                    if (!isResolved) {
                        isResolved = true
                        reject(new Error(`Unexpected redirect (${response.statusCode})`))
                    }
                    return
                }
                
                if (response.statusCode !== 200) {
                    if (!isResolved) {
                        isResolved = true
                        reject(new Error(`HTTP ${response.statusCode}`))
                    }
                    return
                }
                
                let data = ''
                response.on('data', chunk => data += chunk)
                response.on('end', () => {
                    if (!isResolved) {
                        try {
                            const aboutInfo = parser.parse(data)
                            if (aboutInfo.ModMetaData && aboutInfo.ModMetaData.supportedVersions) {
                                const versions = aboutInfo.ModMetaData.supportedVersions.li
                                isResolved = true
                                resolve(Array.isArray(versions) ? versions : [versions])
                            } else {
                                isResolved = true
                                reject(new Error('No supportedVersions found in About.xml'))
                            }
                        } catch (err) {
                            isResolved = true
                            reject(new Error(`Failed to parse XML: ${err.message}`))
                        }
                    }
                })
                response.on('error', (err) => {
                    clearTimeout(timeout)
                    if (!isResolved) {
                        isResolved = true
                        reject(err)
                    }
                })
            })
            
            request.on('error', (err) => {
                clearTimeout(timeout)
                if (!isResolved) {
                    isResolved = true
                    reject(err)
                }
            })
        })
    }
    
    try {
        return await tryFetch(rawUrl)
    } catch (err) {
        if (fallbackUrl) {
            try {
                return await tryFetch(fallbackUrl)
            } catch (fallbackErr) {
                throw new Error(`Failed to fetch versions from both master and main branches`)
            }
        }
        throw err
    }
}

/** @type {Array} */
const rwModlist = await importJson('./mods.json')
const masterlistUrl = 'https://gitgud.io/AblativeAbsolute/libidinous_loader_providers/-/raw/v0/providers.json'
const updateMasterlist = async (data) => {
    let versionSuccessCount = 0
    let versionFailCount = 0
    const versionErrors = []

    for (const [category, mods] of Object.entries(data.providers)) {
        const modlist = Object.entries(mods)

        console.log(chalk.yellow`Checking ${category}: ${Object.keys(mods).length} mods`)

        for (const [mod, info] of modlist) {
            if(info.type !== 'git') { continue; }

            const matchedModIndex = rwModlist.findIndex(m => m.remote == info.url)
            if(matchedModIndex >= 0) {
                const matchedMod = rwModlist[matchedModIndex]
                const updatedEntry = {
                    ...matchedMod,
                    name: matchedMod.name ?? info.name,
                    label: matchedMod.label ?? info.name.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase()),
                    remark: matchedMod.remark || category.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
                }

                const changedEntry = updatedEntry.name !== matchedMod.name ||
                                     updatedEntry.label !== matchedMod.label ||
                                     updatedEntry.remark !== matchedMod.remark ||
                                     updatedEntry.versions !== matchedMod.versions

                rwModlist[matchedModIndex] = updatedEntry

                console.info(changedEntry 
                    ? chalk.yellow`\t${matchedMod.label} => ${info.name} updated`
                    : chalk.white`\t${matchedMod.label} => ${info.name} unchanged`
                )
            } else {
                rwModlist[rwModlist.length] = {
                    name: mod,
                    label: info.name.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase()),
                    remote: info.url,
                    remark: category.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
                }

                console.info(chalk.green`\t${info.name} added`)
            }
        }
    }

    // Fetch versions for all mods (unless skipped)
    if (!skipVersions) {
        console.log(chalk.cyan`\nFetching version information for ${rwModlist.length} mods...`)
        console.log(chalk.gray`(Use --skip-versions or -s to skip this step for faster updates)\n`)
        
        for (let i = 0; i < rwModlist.length; i++) {
            const mod = rwModlist[i]
            
            // Skip deprecated mods or those without remote URLs
            if (mod.deprecated || !mod.remote) {
                continue
            }
            
            try {
                const versions = await fetchModVersions(mod.remote)
                rwModlist[i] = {
                    ...mod,
                    supportedVersions: versions
                }
                versionSuccessCount++
                console.log(chalk.green`✓ ${mod.label.padEnd(50)} ${chalk.yellow`[${versions.join(', ')}]`}`)
            } catch (err) {
                versionFailCount++
                versionErrors.push({ mod: mod.label, error: err.message })
                console.log(chalk.red`✗ ${mod.label.padEnd(50)} ${chalk.gray`(${err.message})`}`)
            }
        }

        // Show version fetching summary
        console.log(chalk.cyan`\nVersion fetch summary:`)
        console.log(chalk.green`  ✓ Success: ${versionSuccessCount} mods`)
        if (versionFailCount > 0) {
            console.log(chalk.red`  ✗ Failed: ${versionFailCount} mods`)
            if (versionErrors.length <= 5) {
                console.log(chalk.gray`\nFailed mods:`)
                versionErrors.forEach(({ mod, error }) => {
                    console.log(chalk.gray`  - ${mod}: ${error}`)
                })
            } else {
                console.log(chalk.gray`\nShowing first 5 failed mods:`)
                versionErrors.slice(0, 5).forEach(({ mod, error }) => {
                    console.log(chalk.gray`  - ${mod}: ${error}`)
                })
                console.log(chalk.gray`  ... and ${versionErrors.length - 5} more`)
            }
        }
    } else {
        console.log(chalk.cyan`\nSkipped version fetching`)
    }

    await writeFile('./mods.json', JSON.stringify(rwModlist, null, 2))
    console.log(chalk.green`\nFinished updating mods.json\n`)
    
    // Clean up HTTPS agent to allow process to exit
    https.globalAgent.destroy()
}

// Check for command line arguments
const skipVersions = process.argv.includes('--skip-versions') || process.argv.includes('-s')

if (skipVersions) {
    console.log(chalk.cyan`Skipping version fetching (--skip-versions flag detected)`)
}

let data = '';
https.get(masterlistUrl, response => {
    response.on('data', d => data += d)
    response.on('end', () => {
        console.log(chalk.green`Downloaded masterlist`)

        updateMasterlist(JSON.parse(data))
    })
})

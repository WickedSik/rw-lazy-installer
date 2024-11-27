#! /usr/bin/env node

import fs from 'fs'
import path from 'path'
import { readFile, unlink } from 'fs/promises'
import chalk from 'chalk'
import Config from 'conf'
import GitRepo from 'simple-git'
import { program } from 'commander'
import { XMLParser } from 'fast-xml-parser'

async function importJson(file) {
    return JSON.parse(await readFile(new URL(file, import.meta.url)))
}

const version = (await importJson('./package.json')).version;

const INSTALLATION_DIR_CONFIG_FIELD = 'installation-dir'
const INSTALLED_MODS_CONFIG_FIELD = 'installed-mods'
const HEADER_ASCII_ART = `
______ _    _   _                       _____          _        _ _           
| ___ \\ |  | | | |                     |_   _|        | |      | | |          
| |_/ / |  | | | |     __ _ _____   _    | | _ __  ___| |_ __ _| | | ___ _ __ 
|    /| |/\\| | | |    / _\` |_  / | | |   | || '_ \\/ __| __/ _\` | | |/ _ \\ '__|
| |\\ \\\\  /\\  / | |___| (_| |/ /| |_| |  _| || | | \\__ \\ || (_| | | |  __/ |   
\\_| \\_|\\/  \\/  \\_____/\\__,_/___|\\__, |  \\___/_| |_|___/\\__\\__,_|_|_|\\___|_|   
                                 __/ |                                        
                                |___/                                  v${version}
`.trim()

const mods = await importJson('./mods.json')
const isModRemote = (url) => {
    return mods.find(mod => mod.remote === url) !== undefined
}
const isInstalledMod = (remote) => {
    const installed = config.get(INSTALLED_MODS_CONFIG_FIELD)
    return typeof(installed) === 'undefined' ? false : installed.filter(i => i.remote.replace('.git', '') === remote.replace('.git', '')).length > 0
}
const modSupportedVersions = (modDir) => {
    return new Promise((resolve, reject) => {
        const parser = new XMLParser();
        fs.readFile(`${modDir}/About/About.xml`, (err, data) => {
            if(err) {
                reject(err)
            } else {
                const aboutInfo = parser.parse(data)
                const versions = aboutInfo.ModMetaData.supportedVersions.li
                resolve(Array.isArray(versions) ? versions : [versions])
            }
        })    
    })
}
const formatVersionRange = (versions) => {
    versions.sort()
    if(versions.length <= 2) {
        return versions.join(', ')
    } else {
        return `${versions[0]}-${versions[versions.length-1]}`
    }
}

const config = new Config({ projectName: 'rimworld-lazy-installer' })

const modInstallationDir = (opt) => {
    return (opt && opt.dir) || config.get(INSTALLATION_DIR_CONFIG_FIELD) || process.cwd()
}

program.version(version)
program
    .option('-d, --dir <dir>', 'RimWorld Mod Directory')

program
    .command('install <name...>')
    .description('Install mods that do not exist yet, this command will not update')
    .action((mods) => {
        console.log(chalk.green.bold`${HEADER_ASCII_ART}\n`)

        mods.map(m => install(m))
    })

program
    .command('update')
    .description('Updates mods, this command will not install new mods')
    .option('-l, --log', 'Show changelog')
    .option('-r, --relevant', 'Show changelog for updated mods')
    .action(update)

program
    .command('uninstall <name...>')
    .description('Uninstalls mod if installed')
    .action((mods) => {
        console.log(chalk.green.bold`${HEADER_ASCII_ART}\n`)

        mods.map(m => uninstall(m))
    })

program
    .command('list', { isDefault: true })
    .description('A little overview of what this does')
    .action(list)

program
    .command('search <term>')
    .description('Search within the list')
    .action(search)

program
    .command('check')
    .description('Reads and lists installed mods')
    .action(() => {
        init(() => {})
    })

function init(callback) {
    const installationDir = modInstallationDir(program.opts())

    console.log(chalk.green.bold`${HEADER_ASCII_ART}\n`)
    console.log(chalk.green`Checking`, chalk.yellow`${installationDir}`, chalk.green`for installed mods\n`)

    // first run
    fs.readdir(installationDir, async (err, files) => {
        const x = await files
            .filter(f => {
                return !(f.charAt(0) === '.' || f === "Icon\r" || f.indexOf('.txt') > -1)
            })
            .map(async file => {
                const dir = path.join(installationDir, file)

                try {
                    const repo = GitRepo(dir)
                    await repo.fetch()
                    const remotes = await repo.getRemotes(true)
                    const fetch = remotes[0].refs.fetch
                    const versions = await modSupportedVersions(dir)

                    if(isModRemote(fetch)) {                        
                        const mod = mods.find(m => m.remote === fetch)

                        if(isInstalledMod(fetch)) {
                            console.log(chalk.green`\tFound`, chalk.white`${mod.name}`, chalk.green`as installed mod`)
                        } else {
                            console.log(chalk.green`\tAdding`, chalk.white`${mod.name}`, chalk.green`as new mod`)
                        }

                        return {
                            name: file,
                            mod: mod.name,
                            dir,
                            remote: remotes[0].refs.fetch,
                            versions: versions
                        }
                    } else {
                        console.log(chalk.red`\tFound`, chalk.white`${file}`, chalk.red`as unknown remote:`, chalk.yellow`${fetch}`)
                        return undefined
                    }
                } catch(e) {
                    return undefined
                }
            })
        
        Promise.all(x).then(async entry => {
            console.log(chalk.green`\n`)

            console.log(chalk.green`Saving installation dir and ${entry.filter(e => e).length} installed mods to config\n`)
            config.set(INSTALLATION_DIR_CONFIG_FIELD, installationDir)
            config.set(INSTALLED_MODS_CONFIG_FIELD, entry.filter(e => e))
        }).finally(() => {
            callback()
        })
    })
}

function list() {
    search(undefined)
}

function search(term) {
    const installationDir = modInstallationDir(program.opts())
    const installed = config.get(INSTALLED_MODS_CONFIG_FIELD).sort((a, b) => a.name.localeCompare(b.name))

    console.log(chalk.green.bold`${HEADER_ASCII_ART}\n`)
    console.log(chalk.green`You have installed:\n`)

    if(!term && installed && installed.length) {
        installed.map(i => {
            const mod = mods.find(m => m.remote === i.remote)
            if(!mod) {
                console.log(
                    chalk.strikethrough.red`\t${'missing'.padEnd(40)}`,
                    chalk.strikethrough.bold.white`${i.name.padEnd(30)}`,
                    chalk.strikethrough.bold.yellow`${formatVersionRange(i.versions || []).padEnd(20)}`,
                    chalk.strikethrough.yellow`${i.dir.replace(installationDir, '[mods]').padEnd(40)}`
                )
            } else if(mod.deprecated) {
                console.log(
                    chalk.strikethrough.green`\t${mod.label.padEnd(40)}`,
                    chalk.strikethrough.bold.white`${i.name.padEnd(30)}`,
                    chalk.strikethrough.bold.yellow`${formatVersionRange(i.versions || []).padEnd(20)}`,
                    chalk.strikethrough.yellow`${i.dir.replace(installationDir, '[mods]').padEnd(40)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            } else {
                console.log(
                    chalk.green`\t${mod.label.padEnd(40)}`,
                    chalk.bold.white`${i.name.padEnd(30)}`,
                    chalk.bold.yellow`${formatVersionRange(i.versions || []).padEnd(20)}`,
                    chalk.yellow`${i.dir.replace(installationDir, '[mods]').padEnd(40)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            }
        })
    } else if(!term) {
        console.log(chalk.red`\tNo mods!`)
    }

    console.log(chalk.green`\nInstall or update the mods with the ${chalk.bold.white`install`} or ${chalk.bold.white`update`} command.\n`)
    console.log(chalk.green`\nInstallable mods:\n\n`)

    const filteredMods = term ? mods.filter(m => m.name.toLowerCase().indexOf(term.toLowerCase()) > -1) : mods
    const longestName = filteredMods.map(m => m.name.length).reduce((p, c = 30) => Math.max(p ,c))
    const longestLabel = filteredMods.map(m => m.label.length).reduce((p, c = 40) => Math.max(p ,c))

    filteredMods.sort((a, b) => a.name.localeCompare(b.name)).map(mod => {
        if(!isInstalledMod(mod.remote)) {
            if(mod.deprecated) {
                console.log(
                    chalk.strikethrough.green`\t${mod.label.padEnd(longestLabel)}`,
                    chalk.strikethrough.bold.white`${mod.name.padEnd(longestName)}`,
                    chalk.strikethrough.yellow`${mod.remote.padEnd(70)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            } else {
                console.log(
                    chalk.green`\t${mod.label.padEnd(longestLabel)}`,
                    chalk.bold.white`${mod.name.padEnd(longestName)}`,
                    chalk.yellow`${mod.remote.padEnd(70)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            }
        }
    })
    console.log(chalk.green`\n\n\ti.e.`, chalk.bold.white`$ rw-lazy-installer install rjw-ex\n`)
}

function install(mod) {
    const installationDir = modInstallationDir(program.opts())
    const m = mods.find(m => m.name === mod)
    
    if(!m) {
        console.log(chalk.red`Mod ${mod} is not a known mod and cannot be installed`)
    } else if(isInstalledMod(m.remote)) {
        console.log(chalk.red`This mod is already installed`)
    } else {
        const i = async () => {
            try {
                const dir = path.join(installationDir, mod)
                await GitRepo().clone(m.remote, dir)

                const installed = config.get(INSTALLED_MODS_CONFIG_FIELD)
                installed.push({
                    name: mod,
                    mod: m.name,
                    dir: path.join(installationDir, mod),
                    remote: m.remote
                })
                config.set(INSTALLED_MODS_CONFIG_FIELD, installed)
            } catch(e) {
                console.log(chalk.red`Failed to install ${mod.name}: ${chalk.white`${e.message}`}`)
            }
        }
        i().then(() => {
            console.log(chalk.green`Installed`, chalk.white`${mod}`)
        }, err => {
            console.log(chalk.red`Failed to install ${mod}: ${chalk.white`${err.message}`}`)
        })
    }
}

function update(opts) {
    const installed = config.get(INSTALLED_MODS_CONFIG_FIELD).sort((a, b) => a.name.localeCompare(b.name))
    const showChangeLog = !!opts.log
    const showOnlyUpdatedChangeLog = !!opts.relevant

    console.log(chalk.green.bold`${HEADER_ASCII_ART}\n`)
    
    const x = installed.map(async mod => {
        try {
            const repo = GitRepo(mod.dir)
            const current = await repo.revparse('HEAD')
            const status = await repo.fetch().pull().revparse('HEAD')
            const installedMod = mods.find(m => m.name == mod.name)

            let log = []
            if(showChangeLog || (showOnlyUpdatedChangeLog && current !== status)) {
                const changelog = await repo.log({ '--max-count': 5 })
                log = changelog.all.map(line => `\t[${line.hash.substring(0, 6)}] ${line.message}`)
            }
            
            if(current === status) {
                console.log(chalk.green`- Checked`, chalk.white`${installedMod.label.padEnd(60)}`, chalk.yellow`[${status.substring(0, 6)}]`)
            } else {
                console.log(chalk.green`- Updated`, chalk.white`${installedMod.label.padEnd(60)}`, chalk.yellow`[${current.substring(0, 6)} -> ${status.substring(0, 6)}]`)
            }
            log.map(line => console.log(chalk.white`${line}`))

        } catch(e) {
            console.log(chalk.red`Failed to update ${mod.name}, please check the git repo at ${mod.dir}: ${e}`)
        }
    })

    Promise.all(x).then(() => {
        console.log(chalk.green`\nAll Mods updated!\n`)
    })
}

function uninstall(mod) {
    const m = mods.find(m => m.name === mod)

    if(!m) {
        console.log(chalk.red`Mod ${mod} is not a known mod and cannot be uninstalled`)
    } else if(!isInstalledMod(m.remote)) {
        console.log(chalk.red`This mod is not installed`)
    } else {
        const installed = config.get(INSTALLED_MODS_CONFIG_FIELD)
        const installDir = installed.find(i => i.remote === m.remote).dir

        const ret = async () => {
            await unlink(`${installDir}/.git`)
            await unlink(installDir)
        }

        ret().then(() => {
            config.set(INSTALLED_MODS_CONFIG_FIELD, installed.filter(i => i.remote === m.remote))

            console.log(chalk.green`Uninstalled ${m.name}`)
        }).catch((err) => {
            console.log(chalk.white`Something went wrong uninstalling ${mod}: ${chalk.red`${err}`}\n\nPlease run manually:`)
            console.log(chalk.yellow`\trm -rf ${installDir}/.git`)
            console.log(chalk.yellow`\trm -r ${installDir}`)
        })
    }
}

program.parse()

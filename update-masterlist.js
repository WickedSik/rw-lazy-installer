import { readFile, writeFile } from 'fs/promises'
import https from 'https'
import chalk from 'chalk'

async function importJson(file) {
    return JSON.parse(await readFile(new URL(file, import.meta.url)))
}

/** @type {Array} */
const rwModlist = await importJson('./mods.json')
const masterlistUrl = 'https://gitgud.io/AblativeAbsolute/libidinous_loader_providers/-/raw/v0/providers.json'
const updateMasterlist = async (data) => {
    Object.entries(data.providers).forEach(([category, mods]) => {
        const modlist = Object.entries(mods)

        console.log(chalk.yellow`Checking ${category}: ${Object.keys(mods).length} mods`)

        modlist.forEach(([mod, info]) => {
            if(info.type !== 'git') { return; }

            const matchedModIndex = rwModlist.findIndex(m => m.remote == info.url)
            if(matchedModIndex >= 0) {
                const matchedMod = rwModlist[matchedModIndex]
                rwModlist[matchedModIndex] = {
                    ...matchedMod,
                    name: matchedMod.name ?? info.name,
                    label: matchedMod.label ?? info.name.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase()),
                    remark: matchedMod.remark || category.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
                }

                console.info(chalk.white`\t${matchedMod.label} => ${info.name} updated`)
            } else {
                rwModlist[rwModlist.length] = {
                    name: mod,
                    label: info.name.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase()),
                    remote: info.url,
                    remark: category.replace(/[-_]/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
                }

                console.info(chalk.green`\t${info.name} added`)
            }
        })
    })

    await writeFile('./mods.json', JSON.stringify(rwModlist, null, 2))
    console.log(chalk.green`\nFinished\n`)
}

let data = '';
https.get(masterlistUrl, response => {
    response.on('data', d => data += d)
    response.on('end', () => {
        console.log(chalk.green`Downloaded masterlist`)

        updateMasterlist(JSON.parse(data))
    })
})

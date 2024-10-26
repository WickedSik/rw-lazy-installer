#! /usr/bin/env node

import fs from 'fs'
import path from 'path'
import { readFile, unlink } from 'fs/promises'
import { cwd } from 'process'
import chalk from 'chalk'
import Config from 'conf'
import GitRepo from 'simple-git'
import { program } from 'commander'

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
    return typeof(installed) === 'undefined' ? false : installed.filter(i => i.remote === remote).length > 0
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
    .command('help', { isDefault: true })
    .description('A little overview of what this does')
    .action(help)

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
                            remote: remotes[0].refs.fetch
                        }
                    } else {
                        console.log(chalk.red`\tFound`, chalk.white`${file}`, chalk.red`as unknown remote:`, chalk.yellow`${fetch}`)
                        return undefined
                    }
                } catch(e) {
                    return undefined
                }
            })
        
        Promise.all(x).then(entry => {
            console.log(chalk.green`\n`)

            console.log(chalk.green`Saving installation dir and installed mods to config\n`)
            config.set(INSTALLATION_DIR_CONFIG_FIELD, installationDir)
            config.set(INSTALLED_MODS_CONFIG_FIELD, entry.filter(e => e))
        }).finally(() => {
            callback()
        })
    })
}

function help() {
    const installationDir = modInstallationDir(program.opts())
    const installed = config.get(INSTALLED_MODS_CONFIG_FIELD).sort((a, b) => a.name.localeCompare(b.name))

    console.log(chalk.green.bold`${HEADER_ASCII_ART}\n`)
    console.log(chalk.green`You have installed:\n`)

    if(installed && installed.length) {
        installed.map(i => {
            const mod = mods.find(m => m.remote === i.remote)
            if(!mod) {
                console.log(
                    chalk.strikethrough.red`\t${'missing'.padEnd(40)}`,
                    chalk.strikethrough.bold.white`\t${i.name.padEnd(30)}`,
                    chalk.strikethrough.yellow`${i.dir.replace(installationDir, '[mods]').padEnd(40)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            } else if(mod.deprecated) {
                console.log(
                    chalk.strikethrough.green`\t${mod.label.padEnd(40)}`,
                    chalk.strikethrough.bold.white`${i.name.padEnd(30)}`,
                    chalk.strikethrough.yellow`${i.dir.replace(installationDir, '[mods]').padEnd(40)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            } else {
                console.log(
                    chalk.green`\t${mod.label.padEnd(40)}`,
                    chalk.bold.white`${i.name.padEnd(30)}`,
                    chalk.yellow`${i.dir.replace(installationDir, '[mods]').padEnd(40)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            }
        })
    } else {
        console.log(chalk.red`\tNo mods!`)
    }

    console.log(chalk.green`\nInstall or update the mods with the ${chalk.bold.white`install`} or ${chalk.bold.white`update`} command.\n`)
    console.log(chalk.green`\nInstallable mods:\n\n`)

    mods.sort((a, b) => a.name.localeCompare(b.name)).map(mod => {
        if(!isInstalledMod(mod.remote)) {
            if(mod.deprecated) {
                console.log(
                    chalk.strikethrough.green`\t${mod.label.padEnd(40)}`,
                    chalk.strikethrough.bold.white`${mod.name.padEnd(30)}`,
                    chalk.strikethrough.yellow`${mod.remote.padEnd(70)}`,
                    mod.remark ? chalk.gray` - ${mod.remark}` : ''
                )
            } else {
                console.log(
                    chalk.green`\t${mod.label.padEnd(40)}`,
                    chalk.bold.white`${mod.name.padEnd(30)}`,
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

#! /usr/bin/env node

import fs from 'fs'
import path from 'path'
import { readFile } from 'fs/promises'
import { cwd } from 'process'
import chalk from 'chalk'
import Config from 'conf'
import GitRepo from 'simple-git'
import { program } from 'commander'

const INSTALLED_MODS_CONFIG_FIELD = 'installed-mods'

async function importJson(file) {
    return JSON.parse(await readFile(new URL(file, import.meta.url)))
}

const mods = await importJson('./mods.json')
const isModRemote = (url) => {
    return mods.find(mod => mod.remote === url) !== undefined
}
const isInstalledMod = (remote) => {
    const installed = config.get(INSTALLED_MODS_CONFIG_FIELD)
    return installed.filter(i => i.remote === remote).length > 0
}

const config = new Config({ projectName: 'rimworld-lazy-installer '})

program.version('1.0.0')
program
    .option('-d, --dir', 'RimWorld Mod Directory', cwd())

program
    .command('install <name>')
    .description('Install mods that do not exist yet, this command will not update')
    .action(install)

program
    .command('update')
    .description('Updates mods, this command will not install new mods')
    .action(update)

program
    .command('help', { isDefault: true })
    .description('A little overview of what this does')
    .action(help)

program
    .command('list')
    .description('Reads and lists installed mods')
    .action(() => {
        init(help)
    })

program
    .command('debug')
    .action(() => {
        const installed = config.get(INSTALLED_MODS_CONFIG_FIELD)
        console.debug(installed)
    })

function init(callback) {
    const installationDir = program.opts().dir || cwd()

    // first run
    fs.readdir(installationDir, async (err, files) => {
        const x = await files
            .filter(f => {
                return !(f.charAt(0) === '.' || f === "Icon\r" || f.indexOf('.txt') > -1)
            })
            .map(async file => {
                const dir = path.join(installationDir, file)
                const repo = GitRepo(dir)
                try {
                    await repo.fetch()
                    const remotes = await repo.getRemotes(true)
                    const fetch = remotes[0].refs.fetch

                    if(isModRemote(fetch)) {
                        const mod = mods.find(m => m.remote === fetch).name
                        
                        return {
                            name: file,
                            mod,
                            dir,
                            remote: remotes[0].refs.fetch
                        }
                    } else {
                        return undefined
                    }
                } catch(e) {
                    return undefined
                }
            })
        
        Promise.all(x).then(entry => {
            config.set(INSTALLED_MODS_CONFIG_FIELD, entry.filter(e => e))
        }).finally(() => {
            callback()
        })
    })
}

function help() {
    const installationDir = program.opts().dir || cwd()
    const installed = config.get(INSTALLED_MODS_CONFIG_FIELD)

    console.log(chalk.green`
Lazy Installer and updater for RJW and submods

You have installed:\n`)

    if(installed && installed.length) {
        installed.map(i => {
            const mod = mods.find(m => m.remote === i.remote)
            console.log(chalk.green`\t${mod.label.padEnd(50)}`, chalk.bold.white`${i.name.padEnd(30)}`, chalk.yellow`${i.dir.replace(installationDir, '[mods]')}`)
        })
    } else {
        console.log(chalk.red`\tNo mods!`)
    }

    console.log(chalk.green`\nInstall or update the mods with the ${chalk.bold.white`install`} or ${chalk.bold.white`update`} command.\n`)
    console.log(chalk.green`\nInstallable mods:\n\n`)

    mods.map(mod => {
        if(!isInstalledMod(mod.remote)) {
            console.log(chalk.green`\t${mod.label.padEnd(50)}`, chalk.bold.white`${mod.name.padEnd(30)}`, chalk.yellow`${mod.remote}`)
        }
    })
    console.log(chalk.green`\n\n\ti.e.`, chalk.bold.white`$ rimworld-lazy-installer install rjw-ex\n`)
}

function install(mod) {
    const installationDir = program.opts().dir || cwd()
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

function update() {
    const installed = config.get(INSTALLED_MODS_CONFIG_FIELD)
    
    const x = installed.map(async mod => {
        try {
            const repo = GitRepo(mod.dir)
            await repo.fetch().pull()
            
            console.log(chalk.green`- Updated`, chalk.white`${mod.name}`)
        } catch(e) {
            console.log(chalk.red`Failed to update ${mod.name}, please check the git repo at ${mod.dir}`)
        }
    })

    Promise.all(x).then(() => {
        console.log(chalk.green`All Mods updated!`)
    })
}

program.parse()

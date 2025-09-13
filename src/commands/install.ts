import chalk from 'chalk';
import { ModManager } from '../services/mod-manager.js';
import type { InstallOptions } from '../types/cli';

/**
 * Install command - installs one or more mods
 */
export async function installCommand(
  modManager: ModManager,
  installDir: string,
  options: InstallOptions
): Promise<void> {
  const { names } = options;

  for (const modName of names) {
    await installSingleMod(modManager, modName, installDir);
  }
}

/**
 * Install a single mod
 */
async function installSingleMod(
  modManager: ModManager,
  modName: string,
  installDir: string
): Promise<void> {
  try {
    // Find mod in registry
    const mod = modManager.findMod(modName);
    if (!mod) {
      console.log(chalk.red`Mod ${modName} is not a known mod and cannot be installed`);
      return;
    }

    // Check if already installed
    if (modManager.isModInstalled(mod.remote)) {
      console.log(chalk.red`Mod ${modName} is already installed`);
      return;
    }

    // Install the mod
    console.log(chalk.yellow`Installing ${modName}...`);
    await modManager.installMod(modName, installDir);

    console.log(chalk.green`Installed`, chalk.white`${modName}`);

  } catch (error) {
    console.log(chalk.red`Failed to install ${modName}: ${chalk.white`${(error as Error).message}`}`);
  }
}
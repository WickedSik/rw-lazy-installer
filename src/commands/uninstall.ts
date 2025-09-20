import chalk from 'chalk';
import { rm } from 'fs/promises';
import { ConfigManager } from '../services/config-manager.js';
import type { CommandOptions } from '../types/command.js';
import type { Mod } from '../types/mod.js';

/**
 * Uninstall specified mods
 */
export async function uninstallCommand(
  modNames: string[],
  options: CommandOptions,
  modsRegistry: Mod[]
): Promise<void> {
  const configManager = new ConfigManager(options.configKey || 'default');

  if (modNames.length === 0) {
    console.error(chalk.red('Error: Please specify at least one mod to uninstall.'));
    process.exit(1);
  }

  const installedMods = configManager.getInstalledMods();
  if (installedMods.length === 0) {
    console.log(chalk.yellow('No mods are currently installed.'));
    return;
  }

  let uninstalledCount = 0;
  let failedCount = 0;
  const results: Array<{ mod: string; status: 'success' | 'not-found' | 'failed'; error?: string }> = [];

  for (const modName of modNames) {
    // Find the mod in registry to get its remote URL
    const modInfo = modsRegistry.find(m => m.name === modName);

    if (!modInfo) {
      console.log(chalk.red(`Mod ${modName} is not a known mod and cannot be uninstalled`));
      results.push({ mod: modName, status: 'not-found' });
      failedCount++;
      continue;
    }

    // Check if the mod is installed
    const installedMod = configManager.findInstalledModByRemote(modInfo.remote);

    if (!installedMod) {
      console.log(chalk.red(`Mod ${modName} is not installed`));
      results.push({ mod: modName, status: 'not-found' });
      failedCount++;
      continue;
    }

    // Try to uninstall the mod
    try {
      console.log(chalk.blue(`Uninstalling ${modName}...`));

      // Remove the directory and its contents
      await rm(installedMod.directory, { recursive: true, force: true });

      // Remove from config
      configManager.removeInstalledMod(installedMod.modId);

      uninstalledCount++;
      results.push({ mod: modName, status: 'success' });
      console.log(chalk.green(`✓ Uninstalled ${modName}`));
    } catch (error) {
      failedCount++;
      results.push({
        mod: modName,
        status: 'failed',
        error: (error as Error).message
      });
      console.error(chalk.red(`✗ Failed to uninstall ${modName}: ${(error as Error).message}`));
      console.log(chalk.yellow(`\nPlease run manually:`));
      console.log(chalk.yellow(`\trm -rf ${installedMod.directory}`));
    }
  }

  // Print summary
  console.log(chalk.cyan('\n=== Uninstall Summary ==='));
  if (uninstalledCount > 0) {
    console.log(chalk.green(`✓ ${uninstalledCount} mod(s) uninstalled successfully`));
  }
  if (failedCount > 0) {
    console.log(chalk.red(`✗ ${failedCount} mod(s) failed to uninstall`));

    const failed = results.filter(r => r.status === 'failed');
    if (failed.length > 0) {
      console.log(chalk.red('\nFailed mods:'));
      failed.forEach(result => {
        console.log(chalk.red(`  - ${result.mod}: ${result.error}`));
      });
    }
  }

  // Exit with error code if any uninstalls failed
  if (failedCount > 0) {
    process.exit(1);
  }
}
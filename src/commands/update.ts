import chalk from 'chalk';
import { ConfigManager } from '../services/config-manager.js';
import { RepositoryManager } from '../services/repository-manager.js';
import type { CommandOptions } from '../types/command.js';

/**
 * Update installed mods to their latest versions
 */
export async function updateCommand(
  modNames: string[],
  options: CommandOptions
): Promise<void> {
  const configManager = new ConfigManager(options.configKey || 'default');
  const repoManager = new RepositoryManager();

  // Get directory from options or config
  const directory = options.dir || configManager.getInstallationDir();
  if (!directory) {
    console.error(
      chalk.red('Error: No installation directory specified.'),
      chalk.yellow('\nUse --dir option or run "check" command first to set the directory.')
    );
    process.exit(1);
  }

  // Get all installed mods
  const installedMods = configManager.getInstalledMods();
  if (installedMods.length === 0) {
    console.log(chalk.yellow('No mods are currently installed.'));
    return;
  }

  // Filter mods to update
  let modsToUpdate = installedMods;
  if (modNames.length > 0) {
    modsToUpdate = installedMods.filter(mod =>
      modNames.includes(mod.modId) || modNames.includes(mod.name)
    );

    if (modsToUpdate.length === 0) {
      console.error(chalk.red('Error: None of the specified mods are installed.'));
      process.exit(1);
    }
  }

  console.log(chalk.cyan(`Updating ${modsToUpdate.length} mod(s)...\n`));

  let updatedCount = 0;
  let failedCount = 0;
  const updateResults: Array<{ mod: string; status: 'updated' | 'no-changes' | 'failed'; error?: string }> = [];

  // Update each mod
  for (const mod of modsToUpdate) {
    try {
      console.log(chalk.blue(`Checking ${mod.name}...`));

      const result = await repoManager.updateRepository(mod.directory);

      if (result.success) {
        if (result.hasChanges) {
          updatedCount++;
          updateResults.push({ mod: mod.name, status: 'updated' });
          console.log(chalk.green(`✓ Updated ${mod.name}`));

          // Update the last updated timestamp
          mod.lastUpdated = new Date();
          mod.lastChecked = new Date();
          configManager.addOrUpdateInstalledMod(mod);
        } else {
          updateResults.push({ mod: mod.name, status: 'no-changes' });
          console.log(chalk.gray(`✓ ${mod.name} is already up to date`));

          // Just update last checked timestamp
          mod.lastChecked = new Date();
          configManager.addOrUpdateInstalledMod(mod);
        }
      } else {
        failedCount++;
        updateResults.push({
          mod: mod.name,
          status: 'failed',
          error: result.error
        });
        console.error(chalk.red(`✗ Failed to update ${mod.name}: ${result.error}`));
      }
    } catch (error) {
      failedCount++;
      updateResults.push({
        mod: mod.name,
        status: 'failed',
        error: (error as Error).message
      });
      console.error(chalk.red(`✗ Failed to update ${mod.name}: ${(error as Error).message}`));
    }
  }

  // Print summary
  console.log(chalk.cyan('\n=== Update Summary ==='));
  console.log(chalk.green(`✓ ${updatedCount} mod(s) updated`));
  console.log(chalk.gray(`= ${updateResults.filter(r => r.status === 'no-changes').length} mod(s) already up to date`));
  if (failedCount > 0) {
    console.log(chalk.red(`✗ ${failedCount} mod(s) failed to update`));

    // Show failed mods
    const failedMods = updateResults.filter(r => r.status === 'failed');
    if (failedMods.length > 0) {
      console.log(chalk.red('\nFailed mods:'));
      failedMods.forEach(result => {
        console.log(chalk.red(`  - ${result.mod}: ${result.error}`));
      });
    }
  }

  // Exit with error code if any updates failed
  if (failedCount > 0) {
    process.exit(1);
  }
}
import chalk from 'chalk';
import { ConfigManager } from '../services/config-manager.js';
import type { CommandOptions } from '../types/command.js';
import type { Mod } from '../types/mod.js';

interface ListCommandOptions extends CommandOptions {
  /** Show installed mods (default: true) */
  installed?: boolean;
  /** Show new/available mods (default: true) */
  new?: boolean;
}

/**
 * List installed and available mods
 */
export async function listCommand(
  options: ListCommandOptions,
  modsRegistry: Mod[]
): Promise<void> {
  const configManager = new ConfigManager(options.configKey || 'default');
  const installDir = options.dir || configManager.getInstallationDir() || '[mods]';

  // Default to showing both if neither is explicitly set
  const showInstalled = options.installed !== false;
  const showNew = options.new !== false;

  const installedMods = configManager.getInstalledMods()
    .sort((a, b) => a.name.localeCompare(b.name));

  // Show installed mods
  if (showInstalled) {
    console.log(chalk.green`You have installed:\n`);

    if (installedMods.length > 0) {
      installedMods.forEach(installed => {
        const mod = modsRegistry.find(m => m.remote === installed.remote);

        if (!mod) {
          // Mod not in registry anymore (missing)
          console.log(
            chalk.strikethrough.red`\t${'missing'.padEnd(40)}`,
            chalk.strikethrough.bold.white`${installed.name.padEnd(30)}`,
            chalk.strikethrough.bold.yellow`${formatVersionRange(installed.supportedVersions || []).padEnd(20)}`,
            chalk.strikethrough.yellow`${installed.directory.replace(installDir, '[mods]').padEnd(40)}`
          );
        } else if (mod.deprecated) {
          // Deprecated mod
          console.log(
            chalk.strikethrough.green`\t${mod.label.padEnd(40)}`,
            chalk.strikethrough.bold.white`${installed.name.padEnd(30)}`,
            chalk.strikethrough.bold.yellow`${formatVersionRange(installed.supportedVersions || []).padEnd(20)}`,
            chalk.strikethrough.yellow`${installed.directory.replace(installDir, '[mods]').padEnd(40)}`,
            mod.remark ? chalk.gray` - ${mod.remark}` : ''
          );
        } else {
          // Normal installed mod
          console.log(
            chalk.green`\t${mod.label.padEnd(40)}`,
            chalk.bold.white`${installed.name.padEnd(30)}`,
            chalk.bold.yellow`${formatVersionRange(installed.supportedVersions || []).padEnd(20)}`,
            chalk.yellow`${installed.directory.replace(installDir, '[mods]').padEnd(40)}`,
            mod.remark ? chalk.gray` - ${mod.remark}` : ''
          );
        }
      });
    } else {
      console.log(chalk.red`\tNo mods found!`);
    }

    console.log(chalk.green`\nInstall or update the mods with the ${chalk.bold.white`install`} or ${chalk.bold.white`update`} command.\n`);
  }

  // Show available mods
  if (showNew) {
    console.log(chalk.green`\nInstallable mods:\n`);

    const installedRemotes = installedMods.map(m => m.remote.replace('.git', ''));
    const availableMods = modsRegistry.filter(mod =>
      !installedRemotes.includes(mod.remote.replace('.git', ''))
    );

    const longestName = Math.max(30, ...availableMods.map(m => m.name.length));
    const longestLabel = Math.max(40, ...availableMods.map(m => m.label.length));

    availableMods
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(mod => {
        if (mod.deprecated) {
          console.log(
            chalk.strikethrough.green`\t${mod.label.padEnd(longestLabel)}`,
            chalk.strikethrough.bold.white`${mod.name.padEnd(longestName)}`,
            chalk.strikethrough.yellow`${mod.remote.padEnd(70)}`,
            mod.remark ? chalk.gray` - ${mod.remark}` : ''
          );
        } else {
          console.log(
            chalk.green`\t${mod.label.padEnd(longestLabel)}`,
            chalk.bold.white`${mod.name.padEnd(longestName)}`,
            chalk.yellow`${mod.remote.padEnd(70)}`,
            mod.remark ? chalk.gray` - ${mod.remark}` : ''
          );
        }
      });

    if (availableMods.length === 0) {
      console.log(chalk.gray`\tAll mods are already installed!`);
    }
  }

  console.log(chalk.green`\n\n\ti.e.`, chalk.bold.white`$ rw-lazy-installer install rjw-ex\n`);
}

/**
 * Format version range for display
 */
function formatVersionRange(versions: string[]): string {
  if (!versions || versions.length === 0) {
    return '';
  }

  const sorted = [...versions].sort();
  if (sorted.length <= 2) {
    return sorted.join(', ');
  } else {
    return `${sorted[0]}-${sorted[sorted.length - 1]}`;
  }
}
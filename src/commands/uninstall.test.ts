import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uninstallCommand } from './uninstall.js';
import type { Mod } from '../types/mod.js';
import { rm } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  rm: vi.fn(),
}));

// Mock ConfigManager
vi.mock('../services/config-manager.js');
import { ConfigManager } from '../services/config-manager.js';
import type { ModInstallation } from '../types/mod.js';

describe('uninstallCommand', () => {
  let configManager: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  const testRegistry: Mod[] = [
    { id: 'mod1', name: 'mod1', label: 'Mod 1', remote: 'https://github.com/test/mod1.git' },
    { id: 'mod2', name: 'mod2', label: 'Mod 2', remote: 'https://github.com/test/mod2.git' },
    { id: 'mod3', name: 'mod3', label: 'Mod 3', remote: 'https://github.com/test/mod3.git' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instance with methods
    configManager = {
      getInstalledMods: vi.fn(() => []),
      findInstalledModByRemote: vi.fn(),
      removeInstalledMod: vi.fn(),
    };

    // Setup the mock implementation to return our instance
    vi.mocked(ConfigManager).mockImplementation(() => configManager);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful uninstall', () => {
    it('should uninstall a single mod', async () => {
      const installedMod: ModInstallation = {
        modId: 'mod1',
        name: 'mod1',
        directory: '/test/mods/mod1',
        remote: 'https://github.com/test/mod1.git',
        installedAt: new Date(),
        lastUpdated: new Date(),
      };

      configManager.getInstalledMods.mockReturnValue([installedMod]);
      configManager.findInstalledModByRemote.mockReturnValue(installedMod);
      vi.mocked(rm).mockResolvedValue(undefined);

      await uninstallCommand(['mod1'], { configKey: 'test' }, testRegistry);

      expect(rm).toHaveBeenCalledWith('/test/mods/mod1', { recursive: true, force: true });
      expect(configManager.removeInstalledMod).toHaveBeenCalledWith('mod1');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Uninstalled mod1'));
    });

    it('should uninstall multiple mods', async () => {
      const installedMod1: ModInstallation = {
        modId: 'mod1',
        name: 'mod1',
        directory: '/test/mods/mod1',
        remote: 'https://github.com/test/mod1.git',
        installedAt: new Date(),
        lastUpdated: new Date(),
      };

      const installedMod2: ModInstallation = {
        modId: 'mod2',
        name: 'mod2',
        directory: '/test/mods/mod2',
        remote: 'https://github.com/test/mod2.git',
        installedAt: new Date(),
        lastUpdated: new Date(),
      };

      configManager.getInstalledMods.mockReturnValue([installedMod1, installedMod2]);
      configManager.findInstalledModByRemote
        .mockReturnValueOnce(installedMod1)
        .mockReturnValueOnce(installedMod2);
      vi.mocked(rm).mockResolvedValue(undefined);

      await uninstallCommand(['mod1', 'mod2'], { configKey: 'test' }, testRegistry);

      expect(rm).toHaveBeenCalledTimes(2);
      expect(rm).toHaveBeenCalledWith('/test/mods/mod1', { recursive: true, force: true });
      expect(rm).toHaveBeenCalledWith('/test/mods/mod2', { recursive: true, force: true });
      expect(configManager.removeInstalledMod).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2 mod(s) uninstalled successfully'));
    });
  });

  describe('error handling', () => {
    it('should handle no mod names provided', async () => {
      await expect(uninstallCommand([], { configKey: 'test' }, testRegistry)).rejects.toThrow(
        'Please specify at least one mod to uninstall'
      );
    });

    it('should handle no installed mods', async () => {
      configManager.getInstalledMods.mockReturnValue([]);

      await uninstallCommand(['mod1'], { configKey: 'test' }, testRegistry);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No mods are currently installed')
      );
    });

    it('should handle unknown mod', async () => {
      configManager.getInstalledMods.mockReturnValue([]);

      await uninstallCommand(['unknown-mod'], { configKey: 'test' }, testRegistry);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No mods are currently installed')
      );
      expect(rm).not.toHaveBeenCalled();
    });

    it('should handle mod not installed', async () => {
      const installedMod: ModInstallation = {
        modId: 'mod1',
        name: 'mod1',
        directory: '/test/mods/mod1',
        remote: 'https://github.com/test/mod1.git',
        installedAt: new Date(),
        lastUpdated: new Date(),
      };

      configManager.getInstalledMods.mockReturnValue([installedMod]);
      configManager.findInstalledModByRemote.mockReturnValue(undefined);

      await expect(uninstallCommand(['mod2'], { configKey: 'test' }, testRegistry)).rejects.toThrow(
        'Failed to uninstall 1 mod(s)'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mod mod2 is not installed')
      );
      expect(rm).not.toHaveBeenCalled();
    });

    it('should handle filesystem errors', async () => {
      const installedMod: ModInstallation = {
        modId: 'mod1',
        name: 'mod1',
        directory: '/test/mods/mod1',
        remote: 'https://github.com/test/mod1.git',
        installedAt: new Date(),
        lastUpdated: new Date(),
      };

      configManager.getInstalledMods.mockReturnValue([installedMod]);
      configManager.findInstalledModByRemote.mockReturnValue(installedMod);
      vi.mocked(rm).mockRejectedValue(new Error('Permission denied'));

      await expect(uninstallCommand(['mod1'], { configKey: 'test' }, testRegistry)).rejects.toThrow(
        'Failed to uninstall 1 mod(s)'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Failed to uninstall mod1: Permission denied')
      );
    });
  });

  describe('summary output', () => {
    it('should show correct summary for mixed results', async () => {
      const installedMod1: ModInstallation = {
        modId: 'mod1',
        name: 'mod1',
        directory: '/test/mods/mod1',
        remote: 'https://github.com/test/mod1.git',
        installedAt: new Date(),
        lastUpdated: new Date(),
      };

      const installedMod2: ModInstallation = {
        modId: 'mod2',
        name: 'mod2',
        directory: '/test/mods/mod2',
        remote: 'https://github.com/test/mod2.git',
        installedAt: new Date(),
        lastUpdated: new Date(),
      };

      configManager.getInstalledMods.mockReturnValue([installedMod1, installedMod2]);
      configManager.findInstalledModByRemote
        .mockReturnValueOnce(installedMod1)
        .mockReturnValueOnce(installedMod2);

      vi.mocked(rm)
        .mockResolvedValueOnce(undefined) // mod1 succeeds
        .mockRejectedValueOnce(new Error('Permission denied')); // mod2 fails

      await expect(uninstallCommand(['mod1', 'mod2'], { configKey: 'test' }, testRegistry)).rejects.toThrow(
        'Failed to uninstall 1 mod(s)'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Uninstalled mod1'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Failed to uninstall mod2: Permission denied')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('1 mod(s) uninstalled successfully'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✗ 1 mod(s) failed to uninstall'));
    });
  });
});
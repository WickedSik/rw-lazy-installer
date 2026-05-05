import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { relinkCommand } from './relink.js';
import type { ModInstallation } from '../types/mod.js';

describe('relinkCommand', () => {
  let modManager: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    modManager = {
      findMod: vi.fn().mockReturnValue({
        id: 'target-mod',
        name: 'target-mod',
        label: 'Target Mod',
        remote: 'https://github.com/test/target.git'
      }),
      relinkMod: vi.fn()
    };

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should relink and report success', async () => {
    const installation: ModInstallation = {
      modId: 'target-mod',
      name: 'some-dir',
      directory: '/test/mods/some-dir',
      remote: 'https://github.com/test/target.git',
      supportedVersions: ['1.5', '1.6'],
      installedAt: new Date(),
      lastUpdated: new Date()
    };

    modManager.relinkMod.mockResolvedValue(installation);

    await relinkCommand(modManager, '/test/mods', {
      directory: 'some-dir',
      target: 'target-mod'
    });

    expect(modManager.relinkMod).toHaveBeenCalledWith(
      'some-dir',
      'target-mod',
      '/test/mods',
      { force: undefined }
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Relinked'),
      expect.stringContaining('some-dir'),
      expect.anything(),
      expect.stringContaining('target-mod')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('versions: 1.5, 1.6')
    );
  });

  it('should warn when target mod is deprecated', async () => {
    modManager.findMod.mockReturnValue({
      id: 'old-mod',
      name: 'old-mod',
      label: 'Old',
      remote: 'https://github.com/test/old.git',
      deprecated: true
    });
    modManager.relinkMod.mockResolvedValue({
      modId: 'old-mod',
      name: 'some-dir',
      directory: '/test/mods/some-dir',
      remote: 'https://github.com/test/old.git',
      supportedVersions: [],
      installedAt: new Date(),
      lastUpdated: new Date()
    });

    await relinkCommand(modManager, '/test/mods', {
      directory: 'some-dir',
      target: 'old-mod'
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("'old-mod' is deprecated")
    );
  });

  it('should pass --force through to relinkMod', async () => {
    modManager.relinkMod.mockResolvedValue({
      modId: 'target-mod',
      name: 'some-dir',
      directory: '/test/mods/some-dir',
      remote: 'https://github.com/test/target.git',
      supportedVersions: [],
      installedAt: new Date(),
      lastUpdated: new Date()
    });

    await relinkCommand(modManager, '/test/mods', {
      directory: 'some-dir',
      target: 'target-mod',
      force: true
    });

    expect(modManager.relinkMod).toHaveBeenCalledWith(
      'some-dir',
      'target-mod',
      '/test/mods',
      { force: true }
    );
  });

  it('should rethrow errors after reporting them', async () => {
    modManager.relinkMod.mockRejectedValue(new Error('uncommitted changes'));

    await expect(relinkCommand(modManager, '/test/mods', {
      directory: 'some-dir',
      target: 'target-mod'
    })).rejects.toThrow('uncommitted changes');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to relink some-dir: uncommitted changes')
    );
  });
});

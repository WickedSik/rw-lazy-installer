import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ModInstallation, Mod } from '../types/mod';

// Use vi.hoisted to ensure xmlParseMock is available in the mock
const { xmlParseMock } = vi.hoisted(() => {
  return {
    xmlParseMock: vi.fn()
  };
});

// Mock fs/promises FIRST - before any imports that might use it
vi.mock('fs/promises', () => {
  const readdir = vi.fn();
  const readFile = vi.fn();
  const rm = vi.fn();

  return {
    default: {
      readdir,
      readFile,
      rm,
    },
    readdir,
    readFile,
    rm,
  };
});

// Mock fast-xml-parser
vi.mock('fast-xml-parser', () => {
  return {
    XMLParser: vi.fn(() => ({
      parse: xmlParseMock
    }))
  };
});

// Now import after mocks are set up
import { ModManager } from './mod-manager';
import { ConfigManager } from './config-manager';
import { RepositoryManager } from './repository-manager';
import fs from 'fs/promises';

describe('ModManager', () => {
  let modManager: ModManager;
  let mockConfig: ConfigManager;
  let mockRepository: RepositoryManager;
  let testMods: Mod[];

  beforeEach(() => {
    // Use resetAllMocks instead of clearAllMocks to preserve mock implementations
    vi.resetAllMocks();

    // Set up default fs mocks
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.readFile).mockRejectedValue(new Error('Not mocked'));
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    // Create test mod data
    testMods = [
      {
        id: 'test-mod-1',
        name: 'test-mod-1',
        label: 'Test Mod 1',
        remote: 'https://github.com/test/test-mod-1.git',
        deprecated: false
      },
      {
        id: 'test-mod-2',
        name: 'test-mod-2',
        label: 'Test Mod 2',
        remote: 'https://github.com/test/test-mod-2.git',
        deprecated: false
      },
      {
        id: 'deprecated-mod',
        name: 'deprecated-mod',
        label: 'Deprecated Mod',
        remote: 'https://github.com/test/deprecated.git',
        deprecated: true,
        remark: 'This mod is deprecated'
      }
    ];

    // Mock ConfigManager
    mockConfig = {
      getInstallationDir: vi.fn().mockReturnValue('/test/mods'),
      setInstallationDir: vi.fn(),
      getInstalledMods: vi.fn().mockReturnValue([]),
      setInstalledMods: vi.fn(),
      addOrUpdateInstalledMod: vi.fn(),
      removeInstalledMod: vi.fn(),
      findInstalledModByRemote: vi.fn(),
      isModInstalled: vi.fn().mockReturnValue(false),
      getPreferences: vi.fn().mockReturnValue({
        autoUpdate: false,
        colorOutput: true,
        verbosity: 'normal',
        parallelOperations: 3
      }),
      updatePreferences: vi.fn(),
      getLastMasterlistUpdate: vi.fn(),
      setLastMasterlistUpdate: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn()
    } as any;

    // Mock RepositoryManager
    mockRepository = {
      cloneRepository: vi.fn().mockResolvedValue(undefined),
      updateRepository: vi.fn().mockResolvedValue({
        success: true,
        hasChanges: false
      }),
      getRepositoryStatus: vi.fn().mockResolvedValue({
        isValidRepo: true,
        currentCommit: 'abc123',
        remoteUrl: 'https://github.com/test/repo.git'
      }),
      getRemoteUrl: vi.fn().mockResolvedValue('https://github.com/test/repo.git'),
      getRecentCommits: vi.fn().mockResolvedValue([]),
      getCurrentCommit: vi.fn().mockResolvedValue('abc123')
    } as any;

    // Create ModManager instance
    modManager = new ModManager(mockConfig, mockRepository, testMods);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('installMod', () => {
    it('should install a mod successfully', async () => {
      const modName = 'test-mod-1';
      const installDir = '/test/mods';

      const result = await modManager.installMod(modName, installDir);

      expect(result).toMatchObject({
        modId: 'test-mod-1',
        name: modName,
        directory: '/test/mods/test-mod-1',
        remote: 'https://github.com/test/test-mod-1.git'
      });

      expect(mockRepository.cloneRepository).toHaveBeenCalledWith(
        'https://github.com/test/test-mod-1.git',
        '/test/mods/test-mod-1'
      );

      expect(mockConfig.addOrUpdateInstalledMod).toHaveBeenCalled();
    });

    it('should throw error for unknown mod', async () => {
      await expect(modManager.installMod('unknown-mod', '/test/mods'))
        .rejects
        .toThrow("Mod 'unknown-mod' is not a known mod and cannot be installed");
    });

    it('should throw error for already installed mod', async () => {
      mockConfig.isModInstalled = vi.fn().mockReturnValue(true);

      await expect(modManager.installMod('test-mod-1', '/test/mods'))
        .rejects
        .toThrow("Mod 'test-mod-1' is already installed");
    });

    it('should extract mod versions from About.xml', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(`
        <ModMetaData>
          <supportedVersions>
            <li>1.4</li>
            <li>1.5</li>
          </supportedVersions>
        </ModMetaData>
      `);

      // Set up XMLParser mock to return parsed data
      xmlParseMock.mockReturnValueOnce({
        ModMetaData: {
          supportedVersions: {
            li: ['1.4', '1.5']
          }
        }
      });

      const result = await modManager.installMod('test-mod-1', '/test/mods');

      expect(result.supportedVersions).toEqual(['1.4', '1.5']);
    });

    it('should handle version extraction failure gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await modManager.installMod('test-mod-1', '/test/mods');

      // Should still install even if version extraction fails
      expect(result).toBeDefined();
      expect(result.supportedVersions).toEqual([]);
    });
  });

  describe('updateMod', () => {
    const testInstallation: ModInstallation = {
      modId: 'test-mod',
      name: 'test-mod',
      directory: '/test/mods/test-mod',
      remote: 'https://github.com/test/test-mod.git',
      installedAt: new Date(),
      lastUpdated: new Date()
    };

    it('should update mod with changes', async () => {
      mockRepository.getCurrentCommit = vi.fn()
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456');

      mockRepository.updateRepository = vi.fn().mockResolvedValue({
        success: true,
        hasChanges: true
      });

      const result = await modManager.updateMod(testInstallation);

      expect(result).toMatchObject({
        modId: 'test-mod',
        success: true,
        hasChanges: true,
        previousVersion: 'abc123',
        newVersion: 'def456'
      });

      expect(mockConfig.addOrUpdateInstalledMod).toHaveBeenCalled();
    });

    it('should update mod without changes', async () => {
      mockRepository.getCurrentCommit = vi.fn().mockResolvedValue('abc123');
      mockRepository.updateRepository = vi.fn().mockResolvedValue({
        success: true,
        hasChanges: false
      });

      const result = await modManager.updateMod(testInstallation);

      expect(result).toMatchObject({
        success: true,
        hasChanges: false
      });
    });

    it('should handle update failure', async () => {
      const error = new Error('Network error');
      mockRepository.updateRepository = vi.fn().mockRejectedValue(error);

      const result = await modManager.updateMod(testInstallation);

      expect(result).toMatchObject({
        modId: 'test-mod',
        success: false,
        hasChanges: false,
        error
      });
    });
  });

  describe('updateAllMods', () => {
    it('should update all installed mods in parallel', async () => {
      const installedMods: ModInstallation[] = [
        {
          modId: 'mod1',
          name: 'mod1',
          directory: '/test/mods/mod1',
          remote: 'https://github.com/test/mod1.git',
          installedAt: new Date(),
          lastUpdated: new Date()
        },
        {
          modId: 'mod2',
          name: 'mod2',
          directory: '/test/mods/mod2',
          remote: 'https://github.com/test/mod2.git',
          installedAt: new Date(),
          lastUpdated: new Date()
        }
      ];

      mockConfig.getInstalledMods = vi.fn().mockReturnValue(installedMods);

      const results = await modManager.updateAllMods();

      expect(results).toHaveLength(2);
      expect(mockRepository.updateRepository).toHaveBeenCalledTimes(2);
    });

    it('should handle empty installed mods list', async () => {
      mockConfig.getInstalledMods = vi.fn().mockReturnValue([]);

      const results = await modManager.updateAllMods();

      expect(results).toEqual([]);
    });
  });

  describe('uninstallMod', () => {
    const testInstallation: ModInstallation = {
      modId: 'test-mod-1',
      name: 'test-mod-1',
      directory: '/test/mods/test-mod-1',
      remote: 'https://github.com/test/test-mod-1.git',
      installedAt: new Date(),
      lastUpdated: new Date()
    };

    it('should uninstall mod successfully', async () => {
      mockConfig.findInstalledModByRemote = vi.fn().mockReturnValue(testInstallation);
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await modManager.uninstallMod('test-mod-1');

      expect(fs.rm).toHaveBeenCalledWith('/test/mods/test-mod-1/.git', {
        recursive: true,
        force: true
      });
      expect(fs.rm).toHaveBeenCalledWith('/test/mods/test-mod-1', {
        recursive: true,
        force: true
      });
      expect(mockConfig.removeInstalledMod).toHaveBeenCalledWith('test-mod-1');
    });

    it('should throw error for unknown mod', async () => {
      await expect(modManager.uninstallMod('unknown-mod'))
        .rejects
        .toThrow("Mod 'unknown-mod' is not a known mod and cannot be uninstalled");
    });

    it('should throw error for not installed mod', async () => {
      mockConfig.findInstalledModByRemote = vi.fn().mockReturnValue(undefined);

      await expect(modManager.uninstallMod('test-mod-1'))
        .rejects
        .toThrow("Mod 'test-mod-1' is not installed");
    });

    it('should provide manual removal instructions on failure', async () => {
      mockConfig.findInstalledModByRemote = vi.fn().mockReturnValue(testInstallation);
      vi.mocked(fs.rm).mockRejectedValue(new Error('Permission denied'));

      await expect(modManager.uninstallMod('test-mod-1'))
        .rejects
        .toThrow(/Failed to remove mod directory.*rm -rf/s);
    });
  });

  describe('scanDirectory', () => {
    it('should scan directory and find mods', async () => {
      vi.mocked(fs.readdir).mockResolvedValueOnce(['test-mod-1', 'test-mod-2', '.hidden'] as any);

      mockRepository.getRepositoryStatus = vi.fn()
        .mockResolvedValueOnce({
          isValidRepo: true,
          currentCommit: 'abc123',
          remoteUrl: 'https://github.com/test/test-mod-1.git'
        })
        .mockResolvedValueOnce({
          isValidRepo: true,
          currentCommit: 'def456',
          remoteUrl: 'https://github.com/test/test-mod-2.git'
        });

      mockConfig.isModInstalled = vi.fn()
        .mockReturnValueOnce(false) // test-mod-1 is new
        .mockReturnValueOnce(true); // test-mod-2 is already installed

      const result = await modManager.scanDirectory('/test/mods');

      expect(result.found).toHaveLength(2);
      expect(result.found[0]).toMatchObject({
        name: 'test-mod-1',
        remote: 'https://github.com/test/test-mod-1.git',
        isNew: true
      });
      expect(result.found[1]).toMatchObject({
        name: 'test-mod-2',
        isNew: false
      });
    });

    it('should identify unknown directories', async () => {
      vi.mocked(fs.readdir).mockResolvedValueOnce(['unknown-dir'] as any);

      mockRepository.getRepositoryStatus = vi.fn().mockResolvedValue({
        isValidRepo: false
      });

      const result = await modManager.scanDirectory('/test/mods');

      expect(result.unknown).toEqual(['unknown-dir']);
    });

    it('should identify missing mods', async () => {
      vi.mocked(fs.readdir).mockResolvedValueOnce([] as any);

      const installedMod: ModInstallation = {
        modId: 'missing-mod',
        name: 'missing-mod',
        directory: '/test/mods/missing-mod',
        remote: 'https://github.com/test/missing.git',
        installedAt: new Date(),
        lastUpdated: new Date()
      };

      mockConfig.getInstalledMods = vi.fn().mockReturnValue([installedMod]);

      const result = await modManager.scanDirectory('/test/mods');

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toEqual(installedMod);
    });

    it('should filter out hidden files and non-directories', async () => {
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        '.git',
        '.DS_Store',
        'Icon\r',
        'readme.txt',
        'valid-mod'
      ] as any);

      mockRepository.getRepositoryStatus = vi.fn().mockResolvedValue({
        isValidRepo: true,
        remoteUrl: 'https://github.com/test/test-mod-1.git'
      });

      await modManager.scanDirectory('/test/mods');

      // Should only check 'valid-mod'
      expect(mockRepository.getRepositoryStatus).toHaveBeenCalledTimes(1);
      expect(mockRepository.getRepositoryStatus).toHaveBeenCalledWith('/test/mods/valid-mod');
    });

    it('should throw error for unreadable directory', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

      await expect(modManager.scanDirectory('/test/mods'))
        .rejects
        .toThrow('Cannot read installation directory: /test/mods');
    });
  });

  describe('findMod', () => {
    it('should find mod by name', () => {
      const mod = modManager.findMod('test-mod-1');
      expect(mod).toEqual(testMods[0]);
    });

    it('should find mod by label', () => {
      const mod = modManager.findMod('Test Mod 1');
      expect(mod).toEqual(testMods[0]);
    });

    it('should return undefined for non-existent mod', () => {
      const mod = modManager.findMod('non-existent');
      expect(mod).toBeUndefined();
    });
  });

  describe('searchMods', () => {
    it('should search mods by term in name', () => {
      const results = modManager.searchMods('test-mod');
      expect(results).toHaveLength(2);
    });

    it('should search mods by term in label', () => {
      const results = modManager.searchMods('Test Mod');
      expect(results).toHaveLength(2);
    });

    it('should search mods by term in remark', () => {
      const results = modManager.searchMods('deprecated');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('deprecated-mod');
    });

    it('should filter out deprecated mods when specified', () => {
      const results = modManager.searchMods('mod', { includeDeprecated: false });
      expect(results).toHaveLength(2);
      expect(results.every(m => !m.deprecated)).toBe(true);
    });

    it('should filter by installation status', () => {
      mockConfig.isModInstalled = vi.fn()
        .mockReturnValueOnce(true) // test-mod-1 is installed
        .mockReturnValueOnce(false) // test-mod-2 is not
        .mockReturnValueOnce(false); // deprecated-mod is not

      const installed = modManager.searchMods('test', { installed: true });
      expect(installed).toHaveLength(1);
      expect(installed[0].name).toBe('test-mod-1');

      // Reset mock for next test
      mockConfig.isModInstalled = vi.fn().mockReturnValue(false);
      const notInstalled = modManager.searchMods('test', { installed: false });
      expect(notInstalled).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const results = modManager.searchMods('xyz');
      expect(results).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const results = modManager.searchMods('TEST MOD');
      expect(results).toHaveLength(2);
    });
  });

  describe('isModInstalled', () => {
    it('should check by mod name', () => {
      mockConfig.isModInstalled = vi.fn().mockReturnValue(true);

      const result = modManager.isModInstalled('test-mod-1');

      expect(result).toBe(true);
      expect(mockConfig.isModInstalled).toHaveBeenCalledWith('https://github.com/test/test-mod-1.git');
    });

    it('should check by remote URL directly', () => {
      mockConfig.isModInstalled = vi.fn().mockReturnValue(true);

      const result = modManager.isModInstalled('https://some-url.git');

      expect(result).toBe(true);
      expect(mockConfig.isModInstalled).toHaveBeenCalledWith('https://some-url.git');
    });

    it('should return false for unknown mod name', () => {
      const result = modManager.isModInstalled('unknown-mod');

      expect(result).toBe(false);
    });
  });

  describe('extractModVersions', () => {
    it('should extract versions from About.xml', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(`<xml></xml>`);

      xmlParseMock.mockReturnValueOnce({
        ModMetaData: {
          supportedVersions: {
            li: ['1.4', '1.5']
          }
        }
      });

      const versions = await modManager.extractModVersions('/test/mod');

      expect(versions).toEqual(['1.4', '1.5']);
      expect(fs.readFile).toHaveBeenCalledWith('/test/mod/About/About.xml', 'utf-8');
      expect(xmlParseMock).toHaveBeenCalledTimes(1);
    });

    it('should handle single version', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(`<xml></xml>`);

      xmlParseMock.mockReturnValueOnce({
        ModMetaData: {
          supportedVersions: {
            li: '1.5'  // Single value, not array
          }
        }
      });

      const versions = await modManager.extractModVersions('/test/mod');

      expect(versions).toEqual(['1.5']);
    });

    it('should return empty array when About.xml not found', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const versions = await modManager.extractModVersions('/test/mod');

      expect(versions).toEqual([]);
    });

    it('should return empty array for invalid XML', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('not valid xml');
      xmlParseMock.mockImplementation(() => {
        throw new Error('Invalid XML');
      });

      const versions = await modManager.extractModVersions('/test/mod');

      expect(versions).toEqual([]);

      // Reset mock for other tests
      xmlParseMock.mockReset();
    });
  });

  describe('getModChangelog', () => {
    it('should get changelog for a mod', async () => {
      const testMod: ModInstallation = {
        modId: 'test',
        name: 'test',
        directory: '/test/mods/test',
        remote: 'https://test.git',
        installedAt: new Date(),
        lastUpdated: new Date()
      };

      const commits = [
        { hash: 'abc123', message: 'Fix bug' }
      ];

      mockRepository.getRecentCommits = vi.fn().mockResolvedValue(commits);

      const result = await modManager.getModChangelog(testMod, 3);

      expect(result).toEqual(commits);
      expect(mockRepository.getRecentCommits).toHaveBeenCalledWith('/test/mods/test', 3);
    });
  });

  describe('generateInstallationReport', () => {
    it('should generate comprehensive installation report', async () => {
      vi.mocked(fs.readdir).mockResolvedValueOnce(['mod1', 'mod2', 'unknown'] as any);

      mockRepository.getRepositoryStatus = vi.fn()
        .mockResolvedValueOnce({
          isValidRepo: true,
          remoteUrl: 'https://github.com/test/test-mod-1.git'
        })
        .mockResolvedValueOnce({
          isValidRepo: true,
          remoteUrl: 'https://github.com/test/test-mod-2.git'
        })
        .mockResolvedValueOnce({
          isValidRepo: false
        });

      const missingMod: ModInstallation = {
        modId: 'missing',
        name: 'missing',
        directory: '/test/mods/missing',
        remote: 'https://github.com/test/missing.git',
        installedAt: new Date(),
        lastUpdated: new Date()
      };

      mockConfig.getInstalledMods = vi.fn().mockReturnValue([missingMod]);
      mockConfig.isModInstalled = vi.fn().mockReturnValue(false);

      const report = await modManager.generateInstallationReport('/test/mods');

      expect(report).toMatchObject({
        totalMods: 3, // Number of mods in registry
        installedMods: 1, // Number in config
        missingMods: ['missing'],
        unknownMods: ['unknown'],
        recommendations: expect.arrayContaining([
          expect.stringContaining('1 mod(s) are in config but missing from disk'),
          expect.stringContaining('1 unknown folder(s) found'),
          expect.stringContaining('2 new mod(s) found')
        ])
      });
    });
  });
});
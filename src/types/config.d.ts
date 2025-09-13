/**
 * Configuration types
 */

import type { ModInstallation } from './mod';

/**
 * User preferences for the application
 */
export interface UserPreferences {
  /** Automatically update mods on check */
  autoUpdate?: boolean;

  /** Use colored console output */
  colorOutput?: boolean;

  /** Verbosity level */
  verbosity?: 'quiet' | 'normal' | 'verbose';

  /** Number of parallel operations */
  parallelOperations?: number;
}

/**
 * Application configuration schema
 */
export interface AppConfig {
  /** Configuration version for migrations */
  version?: number;

  /** Path to RimWorld mods directory */
  installationDir: string;

  /** List of installed mods */
  installedMods: ModInstallation[];

  /** User preferences */
  preferences?: UserPreferences;

  /** Last time masterlist was updated */
  lastMasterlistUpdate?: Date;
}

/**
 * Configuration migration result
 */
export interface ConfigMigrationResult {
  /** Whether migration was needed */
  migrated: boolean;

  /** Previous version */
  fromVersion?: number;

  /** New version */
  toVersion?: number;

  /** Backup location if created */
  backupPath?: string;
}
/**
 * CLI command types
 */

/**
 * Command line options passed to various commands
 */
export interface CliOptions {
  /** Path to mods directory */
  dir?: string;

  /** Force operation even if warnings */
  force?: boolean;

  /** Verbose output */
  verbose?: boolean;

  /** Suppress all output */
  quiet?: boolean;

  /** Show detailed logs */
  log?: boolean;

  /** Number of parallel operations */
  parallel?: number;
}

/**
 * Install command options
 */
export interface InstallOptions extends CliOptions {
  /** Mod names to install */
  names: string[];
}

/**
 * Update command options
 */
export interface UpdateOptions extends CliOptions {
  /** Update all mods */
  all?: boolean;

  /** Specific mod names to update */
  names?: string[];
}

/**
 * List command options
 */
export interface ListOptions extends CliOptions {
  /** Show deprecated mods */
  deprecated?: boolean;

  /** Show installed mods only */
  installed?: boolean;

  /** Show not installed mods only */
  notInstalled?: boolean;
}

/**
 * Search command options
 */
export interface SearchOptions extends CliOptions {
  /** Search term */
  term: string;

  /** Include deprecated in search */
  deprecated?: boolean;
}

/**
 * Check command options
 */
export interface CheckOptions extends CliOptions {
  /** Fix issues automatically */
  fix?: boolean;
}
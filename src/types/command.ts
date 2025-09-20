/**
 * Common options for CLI commands
 */
export interface CommandOptions {
  /** Installation directory override */
  dir?: string;
  /** Configuration key for storing settings */
  configKey?: string;
  /** Show verbose output */
  verbose?: boolean;
  /** Force operation without prompts */
  force?: boolean;
}
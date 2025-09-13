/**
 * Git operation types - minimal set for mod installation
 */

/**
 * Result from a Git pull operation
 */
export interface GitPullResult {
  /** Whether pull succeeded */
  success: boolean;

  /** Whether there were any changes */
  hasChanges: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Simple Git status for checking if repo is valid
 */
export interface GitStatus {
  /** Whether this is a valid Git repository */
  isValidRepo: boolean;

  /** Current commit hash (for version tracking) */
  currentCommit?: string;

  /** Remote URL */
  remoteUrl?: string;
}
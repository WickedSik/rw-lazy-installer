import chalk from 'chalk';

/**
 * Display utilities
 */

/**
 * Get the ASCII art header with version
 */
export function getHeader(version: string): string {
  return chalk.green.bold`
______ _    _   _                       _____          _        _ _
| ___ \\ |  | | | |                     |_   _|        | |      | | |
| |_/ / |  | | | |     __ _ _____   _    | | _ __  ___| |_ __ _| | | ___ _ __
|    /| |/\\| | | |    / _\` |_  / | | |   | || '_ \\/ __| __/ _\` | | |/ _ \\ '__|
| |\\ \\\\  /\\  / | |___| (_| |/ /| |_| |  _| || | | \\__ \\ || (_| | | |  __/ |
\\_| \\_|\\/  \\/  \\_____/\\__,_/___|\\__, |  \\___/_| |_|___/\\__\\__,_|_|_|\\___|_|
                                 __/ |
                                |___/                                  v${version}`.trim();
}

/**
 * Show the header
 */
export function showHeader(version: string): void {
  console.log(getHeader(version) + '\n');
}
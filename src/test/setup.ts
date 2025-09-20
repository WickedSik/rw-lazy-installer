/**
 * Global test setup
 */

import { vi, beforeEach } from 'vitest';

// Setup global test utilities
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

// Suppress console output during tests unless needed
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};
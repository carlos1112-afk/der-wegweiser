/**
 * Lightweight logging utility.
 * Logs are suppressed in production builds unless explicitly enabled.
 * Use this instead of raw console.* to satisfy Phase 3.5.
 */
const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV === true;

function shouldLog(): boolean {
  return isDev;
}

export const logger = {
  log: (...args: unknown[]): void => {
    if (shouldLog()) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (shouldLog()) {
      console.info(...args);
    }
  },
  debug: (...args: unknown[]): void => {
    if (shouldLog()) {
      console.debug(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    // Warnings may be useful in production for diagnostics; keep visible but
    // can be silenced if needed. For now, keep as-is.
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};

export default logger;

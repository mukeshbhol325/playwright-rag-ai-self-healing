import { env } from '../config/env';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

function log(level: Level, scope: string, message: string): void {
  const threshold = LEVELS[env.logLevel as Level] ?? LEVELS.info;
  if (LEVELS[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  (level === 'error' ? console.error : console.log)(line);
}

export const createLogger = (scope: string) => ({
  debug: (m: string) => log('debug', scope, m),
  info: (m: string) => log('info', scope, m),
  warn: (m: string) => log('warn', scope, m),
  error: (m: string) => log('error', scope, m),
});

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value === undefined || value === '' || Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://demo.opencart.com',
  healerUrl: (process.env.HEALER_URL ?? 'http://localhost:8000').replace(/\/$/, ''),

  healingEnabled: bool(process.env.HEALING_ENABLED, true),
  /** Short first-attempt timeout so a drifted locator fails fast and healing starts quickly. */
  actionTimeoutMs: num(process.env.HEAL_ACTION_TIMEOUT_MS, 5000),
  healerTimeoutMs: num(process.env.HEALER_TIMEOUT_MS, 15000),
  minConfidence: num(process.env.MIN_CONFIDENCE, 0.6),
  maxCandidates: num(process.env.MAX_CANDIDATES, 3),
  maxDomChars: num(process.env.MAX_DOM_CHARS, 150000),
  useHealedCache: bool(process.env.USE_HEALED_CACHE, false),
  maxHeals: num(process.env.MAX_HEALS, -1),

  simulateDrift: bool(process.env.SIMULATE_DRIFT, false),
  logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),

  reportDir: path.resolve(__dirname, '../../reports/healing'),
} as const;

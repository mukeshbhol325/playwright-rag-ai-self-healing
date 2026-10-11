import * as fs from 'fs';
import { HealerClient } from '../api/HealerClient';
import { env } from '../config/env';
import { createLogger } from './logger';

const log = createLogger('setup');

/** Runs once before the suite: ensure report dir exists and tell the user if healing is available. */
export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(env.reportDir, { recursive: true });
  if (!env.healingEnabled) {
    log.info('Self-healing is disabled (HEALING_ENABLED=false)');
    return;
  }
  const healthy = await new HealerClient().isHealthy();
  if (healthy) log.info(`Healer service reachable at ${env.healerUrl}`);
  else log.warn(`Healer service NOT reachable at ${env.healerUrl}. Tests run without self-healing.`);
}

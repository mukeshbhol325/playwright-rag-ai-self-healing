import { env } from '../config/env';
import { HEALER_API } from '../config/constants';
import { createLogger } from '../utils/logger';
import type {
  FailureAnalysis,
  FailureReport,
  FeedbackRequest,
  HealRequest,
  HealResponse,
} from '../types/healing';

const log = createLogger('healer-client');

const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_OPEN_MS = 60_000;

/**
 * REST client for the Python healer service.
 * Every call degrades to `null` on failure, so a down or slow service can never
 * hang a test run; the test simply fails the way it would without healing.
 */
export class HealerClient {
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly baseUrl: string = env.healerUrl,
    private readonly timeoutMs: number = env.healerTimeoutMs,
  ) {}

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.request<{ status: string }>('GET', HEALER_API.health, undefined, 3000);
      return res.status === 'ok';
    } catch {
      return false;
    }
  }

  heal(body: HealRequest): Promise<HealResponse | null> {
    return this.post<HealResponse>(HEALER_API.heal, body);
  }

  async feedback(body: FeedbackRequest): Promise<void> {
    await this.post(HEALER_API.feedback, body);
  }

  reportFailure(body: FailureReport): Promise<FailureAnalysis | null> {
    return this.post<FailureAnalysis>(HEALER_API.failures, body);
  }

  private async post<T>(path: string, body: unknown): Promise<T | null> {
    if (Date.now() < this.circuitOpenUntil) {
      log.warn(`Circuit open, skipping ${path}`);
      return null;
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await this.request<T>('POST', path, body);
        this.consecutiveFailures = 0;
        return result;
      } catch (err) {
        log.warn(`POST ${path} attempt ${attempt} failed: ${(err as Error).message}`);
      }
    }
    if (++this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      log.error(`Healer unreachable ${this.consecutiveFailures}x, pausing calls for ${CIRCUIT_OPEN_MS / 1000}s`);
    }
    return null;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

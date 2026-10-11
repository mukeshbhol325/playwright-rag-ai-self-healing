import type { Locator, Page, TestInfo } from '@playwright/test';
import { HealerClient } from '../api/HealerClient';
import { env } from '../config/env';
import type { HealAction, HealCandidate, HealingEvent } from '../types/healing';
import { captureDom } from '../utils/domSnapshot';
import { createLogger } from '../utils/logger';
import { LocatorRegistry } from './LocatorRegistry';
import { LocatorValidator } from './LocatorValidator';

const log = createLogger('healing');

type Params = Record<string, string>;
type Operation<T> = (locator: Locator, timeoutMs: number | undefined) => Promise<T>;

/**
 * Wraps Playwright's Page. Every interaction goes through a locator *key*:
 *
 *   1. try the registered selector with a short timeout
 *   2. on a locator failure, send DOM + error to the healer service (REST)
 *   3. validate each suggested selector in the live page
 *   4. retry the action with the first one that validates
 *   5. report the outcome back so the service learns, and record the heal
 *
 * Only element *lookups* are healed. Assertions are never healed, so a healed
 * test cannot mask a real product bug.
 */
export class HealingPage {
  readonly events: HealingEvent[] = [];

  constructor(
    readonly page: Page,
    private readonly registry: LocatorRegistry,
    private readonly client: HealerClient,
    private readonly validator: LocatorValidator = new LocatorValidator(),
    private readonly testInfo?: TestInfo,
  ) {}

  // ---- public API used by page objects --------------------------------------
  selectorFor(key: string, params?: Params): string {
    return this.registry.resolve(key, params).selector;
  }

  /** Raw locator, no healing. Use for read-only Playwright assertions. */
  locator(key: string, params?: Params): Locator {
    return this.page.locator(this.selectorFor(key, params));
  }

  click(key: string, params?: Params): Promise<void> {
    return this.act('click', key, params, (l, t) => l.click({ timeout: t }));
  }

  fill(key: string, value: string, params?: Params): Promise<void> {
    return this.act('fill', key, params, (l, t) => l.fill(value, { timeout: t }));
  }

  check(key: string, params?: Params): Promise<void> {
    return this.act('check', key, params, (l, t) => l.check({ timeout: t }));
  }

  async selectByLabel(key: string, label: string, params?: Params): Promise<void> {
    await this.act('select', key, params, (l, t) => l.selectOption({ label }, { timeout: t }));
  }

  async selectByIndex(key: string, index: number, params?: Params): Promise<void> {
    await this.act('select', key, params, (l, t) => l.selectOption({ index }, { timeout: t }));
  }

  waitVisible(key: string, params?: Params): Promise<void> {
    return this.act('wait', key, params, (l, t) => l.first().waitFor({ state: 'visible', timeout: t }));
  }

  async textContent(key: string, params?: Params): Promise<string> {
    return this.act('wait', key, params, async (l, t) => (await l.first().textContent({ timeout: t })) ?? '');
  }

  async allTextContents(key: string, params?: Params): Promise<string[]> {
    return this.act('wait', key, params, async (l, t) => {
      await l.first().waitFor({ state: 'visible', timeout: t });
      return (await l.allTextContents()).map((s) => s.trim());
    });
  }

  async isVisible(key: string, params?: Params): Promise<boolean> {
    return this.locator(key, params).first().isVisible();
  }

  /** Attach healing events to the test result; the reporter reads them from there. */
  async flushEvents(): Promise<void> {
    if (!this.testInfo || this.events.length === 0) return;
    await this.testInfo.attach('healing-events.json', {
      body: JSON.stringify(this.events, null, 2),
      contentType: 'application/json',
    });
  }

  // ---- core -------------------------------------------------------------------
  private async act<T>(action: HealAction, key: string, params: Params | undefined, op: Operation<T>): Promise<T> {
    const { selector } = this.registry.resolve(key, params);
    const firstTimeout = env.healingEnabled ? env.actionTimeoutMs : undefined;
    const started = Date.now();
    try {
      return await op(this.page.locator(selector), firstTimeout);
    } catch (err) {
      if (!env.healingEnabled || !this.isLocatorFailure(err)) throw err;
      return this.heal(action, key, selector, err as Error, op, started);
    }
  }

  private isLocatorFailure(err: unknown): boolean {
    const e = err as Error;
    return e?.name === 'TimeoutError' || /strict mode violation|waiting for locator|waiting for selector/i.test(e?.message ?? '');
  }

  /** If the registered selector resolves to one visible element, the failure is not locator drift. */
  private async resolvesToSingleVisibleElement(selector: string): Promise<boolean> {
    try {
      const l = this.page.locator(selector);
      return (await l.count()) === 1 && (await l.isVisible());
    } catch {
      return false;
    }
  }

  private async heal<T>(
    action: HealAction,
    key: string,
    selector: string,
    original: Error,
    op: Operation<T>,
    started: number,
  ): Promise<T> {
    if (await this.resolvesToSingleVisibleElement(selector)) throw original;

    const base = { locatorKey: key, action, originalSelector: selector, pageUrl: this.page.url() };
    log.info(`'${key}' failed (${selector}); asking healer service`);

    const response = await this.client.heal({
      test_name: this.testName,
      action,
      failed_selector: selector,
      error: original.message.split('\n').slice(0, 3).join(' ').slice(0, 500),
      page_url: this.page.url(),
      dom: await captureDom(this.page),
    });

    if (!response) {
      this.record({ ...base, status: 'skipped', reason: 'healer service unavailable' }, started);
      throw this.annotate(original, 'Self-healing skipped: healer service unavailable.');
    }

    const ranked = response.candidates
      .filter((c) => c.confidence >= env.minConfidence && c.selector !== selector)
      .slice(0, env.maxCandidates);

    if (ranked.length === 0) {
      this.record({ ...base, status: 'failed', strategy: response.strategy, reason: `no candidate with confidence >= ${env.minConfidence}` }, started);
      throw this.annotate(original, 'Self-healing found no confident candidate.');
    }

    for (const candidate of ranked) {
      const verdict = await this.validator.validate(this.page, candidate.selector, action);
      if (!verdict.ok) {
        log.debug(`rejected ${candidate.selector}: ${verdict.reason}`);
        await this.feedback(selector, candidate, false, verdict.reason);
        continue;
      }
      try {
        const result = await op(this.page.locator(candidate.selector), env.actionTimeoutMs);
        await this.feedback(selector, candidate, true, 'action succeeded');
        this.registry.recordHeal(key, selector, candidate);
        this.record(
          {
            ...base,
            status: 'healed',
            healedSelector: candidate.selector,
            confidence: candidate.confidence,
            source: candidate.source,
            strategy: response.strategy,
            reason: candidate.reason,
          },
          started,
        );
        log.info(`healed '${key}': ${selector} -> ${candidate.selector} (${candidate.confidence}, ${candidate.source})`);
        return result;
      } catch (err) {
        await this.feedback(selector, candidate, false, `action failed: ${(err as Error).message.split('\n')[0]}`);
      }
    }

    this.record({ ...base, status: 'failed', strategy: response.strategy, reason: 'no candidate validated' }, started);
    throw this.annotate(original, `Self-healing tried ${ranked.length} candidate(s); none worked.`);
  }

  private async feedback(failed: string, c: HealCandidate, success: boolean, reason: string): Promise<void> {
    await this.client.feedback({
      test_name: this.testName,
      failed_selector: failed,
      healed_selector: c.selector,
      success,
      page_url: this.page.url(),
      reason,
    });
  }

  private record(event: Omit<HealingEvent, 'testName' | 'durationMs' | 'timestamp'>, started: number): void {
    const full: HealingEvent = { ...event, testName: this.testName, durationMs: Date.now() - started, timestamp: new Date().toISOString() };
    this.events.push(full);
    if (full.status === 'healed') {
      this.testInfo?.annotations.push({
        type: 'healed',
        description: `${full.locatorKey}: ${full.originalSelector} -> ${full.healedSelector}`,
      });
    }
  }

  private annotate(err: Error, note: string): Error {
    err.message = `${err.message}\n\n${note}`;
    return err;
  }

  private get testName(): string {
    return this.testInfo ? this.testInfo.titlePath.slice(1).join(' › ') : 'unknown';
  }
}

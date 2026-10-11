import * as fs from 'fs';
import * as path from 'path';
import { HealerClient } from '../../src/api/HealerClient';
import { env } from '../../src/config/env';
import { expect, test } from '../../src/fixtures/test';
import { DEFAULT_DRIFT_KEYS } from '../../src/utils/drift';

/**
 * Offline integration test of the whole healing loop (TypeScript client -> Python
 * RAG service -> live-page validation -> retry -> feedback) against a local
 * OpenCart-style page. Needs the healer service running, but no internet.
 */
const MOCK_HTML = fs.readFileSync(path.resolve(__dirname, '../../test-data/mock-opencart.html'), 'utf8');

test.describe('Self-healing, offline mock storefront', () => {
  test.use({ driftKeys: DEFAULT_DRIFT_KEYS });

  test.beforeAll(async () => {
    test.skip(!(await new HealerClient().isHealthy()), `Healer service is not reachable at ${env.healerUrl}`);
  });

  test('heals every stale locator and completes the flow @offline', async ({ page, healer }) => {
    await page.setContent(MOCK_HTML);

    await healer.click('category.firstAddToCart');
    expect(await healer.textContent('alert.success')).toContain('added');

    await healer.fill('checkout.firstName', 'Asha');
    await healer.fill('checkout.email', 'asha@example.com');
    await healer.fill('checkout.address1', '12 Test Street');
    await healer.click('checkout.registerContinue');
    await expect(page.locator('#saved')).toBeVisible();
    await healer.click('checkout.confirmOrder');
    await expect(page.locator('#done')).toHaveText('Your order has been placed!');

    // The right elements were filled, not just *some* element.
    await expect(page.locator('#input-firstname')).toHaveValue('Asha');
    await expect(page.locator('#input-email')).toHaveValue('asha@example.com');
    await expect(page.locator('#input-shipping-address-1')).toHaveValue('12 Test Street');
    await expect(page.locator('#input-shipping-address-2')).toHaveValue('');

    const healed = healer.events.filter((e) => e.status === 'healed');
    expect(healed.map((e) => e.locatorKey).sort()).toEqual(
      ['category.firstAddToCart', 'checkout.address1', 'checkout.confirmOrder', 'checkout.email', 'checkout.firstName', 'checkout.registerContinue'].sort(),
    );
    expect(healed.every((e) => (e.confidence ?? 0) >= env.minConfidence)).toBe(true);
  });

  test('learns from feedback: a repeated heal is answered from memory @offline', async ({ page, healer }) => {
    await page.setContent(MOCK_HTML);
    await healer.fill('checkout.email', 'first@example.com'); // heals (heuristic, or memory if seen before)

    await page.setContent(MOCK_HTML); // fresh page, same stale locator
    await healer.fill('checkout.email', 'second@example.com');

    const last = healer.events.filter((e) => e.status === 'healed').at(-1);
    expect(last?.source).toBe('memory');
    expect(last?.strategy).toBe('memory+heuristic');
    await expect(page.locator('#input-email')).toHaveValue('second@example.com');
  });

  test('fails clearly instead of healing to a wrong element @offline', async ({ page, healer }) => {
    await page.setContent('<html><body><p>Nothing interactive here</p></body></html>');
    await expect(healer.click('category.firstAddToCart')).rejects.toThrow(/Self-healing/);
    expect(healer.events.at(-1)?.status).toBe('failed');
  });
});

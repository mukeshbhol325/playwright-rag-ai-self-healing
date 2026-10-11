import { HealerClient } from '../../src/api/HealerClient';
import { TEXT } from '../../src/config/constants';
import { env } from '../../src/config/env';
import { expect, test } from '../../src/fixtures/test';
import { DEFAULT_DRIFT_KEYS } from '../../src/utils/drift';
import { buildCustomer } from '../../src/utils/testData';

/**
 * Demonstrates self-healing against the live OpenCart demo: selected registry
 * selectors are replaced with stale ones, and the framework must repair them
 * through the Python RAG service and still complete the business flow.
 */
test.describe('Self-healing locators', () => {
  test.use({ driftKeys: DEFAULT_DRIFT_KEYS });

  test.beforeAll(async () => {
    test.skip(!env.healingEnabled, 'HEALING_ENABLED=false');
    const healthy = await new HealerClient().isHealthy();
    test.skip(!healthy, `Healer service is not reachable at ${env.healerUrl}. Start healer-service first.`);
  });

  test('heals a stale add-to-cart locator @healing', async ({ smartphonePage, healer }) => {
    await smartphonePage.open();
    const name = await smartphonePage.addFirstPhoneToCart();
    expect(await smartphonePage.alert.successText()).toContain(name);

    const healedKeys = healer.events.filter((e) => e.status === 'healed').map((e) => e.locatorKey);
    expect(healedKeys).toContain('category.firstAddToCart');
  });

  test('heals several stale locators during a full guest checkout @healing', async ({
    smartphonePage,
    cartPage,
    checkoutPage,
    orderSuccessPage,
    healer,
  }) => {
    await smartphonePage.open();
    await smartphonePage.addFirstPhoneToCart();
    await cartPage.open();
    await cartPage.proceedToCheckout();
    await checkoutPage.placeGuestOrder(buildCustomer());

    expect(await orderSuccessPage.heading()).toContain(TEXT.orderPlaced);
    const healed = healer.events.filter((e) => e.status === 'healed');
    expect(healed.length).toBeGreaterThanOrEqual(3);
    expect(healed.every((e) => e.confidence !== undefined && e.confidence >= env.minConfidence)).toBe(true);
  });
});

import { test as base, expect } from '@playwright/test';
import { HealerClient } from '../api/HealerClient';
import { env } from '../config/env';
import { HealingPage } from '../healing/HealingPage';
import { LocatorRegistry } from '../healing/LocatorRegistry';
import { LocatorValidator } from '../healing/LocatorValidator';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { HomePage } from '../pages/HomePage';
import { OrderSuccessPage } from '../pages/OrderSuccessPage';
import { ProductPage } from '../pages/ProductPage';
import { SmartphonePage } from '../pages/SmartphonePage';
import { DEFAULT_DRIFT_KEYS } from '../utils/drift';

/** One client per worker, so the circuit breaker state is shared across its tests. */
const healerClient = new HealerClient();

type Fixtures = {
  /** Locator keys to deliberately break for this test (demo / healing specs). */
  driftKeys: string[];
  healer: HealingPage;
  homePage: HomePage;
  smartphonePage: SmartphonePage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  orderSuccessPage: OrderSuccessPage;
};

export const test = base.extend<Fixtures>({
  driftKeys: [[], { option: true }],

  healer: async ({ page, driftKeys }, use, testInfo) => {
    const keys = [...new Set([...(env.simulateDrift ? DEFAULT_DRIFT_KEYS : []), ...driftKeys])];
    const registry = new LocatorRegistry({ driftKeys: keys, useHealedCache: env.useHealedCache });
    const healer = new HealingPage(page, registry, healerClient, new LocatorValidator(), testInfo);
    await use(healer);
    await healer.flushEvents();
  },

  homePage: async ({ healer }, use) => use(new HomePage(healer)),
  smartphonePage: async ({ healer }, use) => use(new SmartphonePage(healer)),
  productPage: async ({ healer }, use) => use(new ProductPage(healer)),
  cartPage: async ({ healer }, use) => use(new CartPage(healer)),
  checkoutPage: async ({ healer }, use) => use(new CheckoutPage(healer)),
  orderSuccessPage: async ({ healer }, use) => use(new OrderSuccessPage(healer)),
});

export { expect };

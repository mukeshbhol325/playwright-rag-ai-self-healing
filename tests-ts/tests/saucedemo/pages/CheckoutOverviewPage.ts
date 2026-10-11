import type { Locator } from '@playwright/test';
import type { HealingPage } from '../../../src/healing/HealingPage';

export class CheckoutOverviewPage {
  constructor(private readonly h: HealingPage) {}
  get cancel(): Locator { return this.h.locator('sd.overview.cancel'); }
  get finish(): Locator { return this.h.locator('sd.overview.finish'); }
  text(value: string) { return this.h.page.getByText(value, { exact: true }); }
  async cancelOrder() { await this.h.click('sd.overview.cancel'); }
  async finishOrder() { await this.h.click('sd.overview.finish'); }
}

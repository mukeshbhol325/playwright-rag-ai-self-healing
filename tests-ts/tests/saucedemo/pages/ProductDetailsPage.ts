import type { Locator } from '@playwright/test';
import type { HealingPage } from '../../../src/healing/HealingPage';

export class ProductDetailsPage {
  constructor(private readonly h: HealingPage) {}
  get addToCart(): Locator { return this.h.locator('sd.details.addToCart'); }
  get remove(): Locator { return this.h.page.locator('[data-test="remove"]'); }
  get backToProducts(): Locator { return this.h.locator('sd.details.back'); }
  productName(name: string) { return this.h.page.getByText(name, { exact: true }); }
  price(value: string) { return this.h.page.getByText(value, { exact: true }); }
  async addItem() { await this.h.click('sd.details.addToCart'); }
  async back() { await this.h.click('sd.details.back'); }
}

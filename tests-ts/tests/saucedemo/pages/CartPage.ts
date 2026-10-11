import type { Locator } from '@playwright/test';
import type { HealingPage } from '../../../src/healing/HealingPage';

export class CartPage {
  constructor(private readonly h: HealingPage) {}
  get continueShopping(): Locator { return this.h.locator('sd.cart.continueShopping'); }
  get checkout(): Locator { return this.h.locator('sd.cart.checkout'); }
  item(name: string) { return this.h.page.getByText(name, { exact: true }); }
  async continueShoppingAction() { await this.h.click('sd.cart.continueShopping'); }
  async checkoutAction() { await this.h.click('sd.cart.checkout'); }
  async removeItem(name: string) {
    const slug = name.toLowerCase().replaceAll(' ', '-');
    await this.h.click('sd.cart.removeByName', { slug });
  }
}

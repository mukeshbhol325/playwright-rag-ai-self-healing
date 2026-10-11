import type { Locator } from '@playwright/test';
import type { HealingPage } from '../../../src/healing/HealingPage';

export class InventoryPage {
  constructor(private readonly h: HealingPage) {}
  get title(): Locator { return this.h.page.getByText('Products', { exact: true }); }
  get menuButton(): Locator { return this.h.page.getByRole('button', { name: 'Open Menu' }); }
  get cartButton(): Locator { return this.h.locator('sd.inventory.cart'); }
  get sortProducts(): Locator { return this.h.locator('sd.inventory.sort'); }
  product(name: string): Locator { return this.h.locator('sd.inventory.productByName', { name }); }
  addButton(name: string): Locator { return this.h.page.locator(`[data-test="add-to-cart-${name.toLowerCase().replaceAll(' ', '-').replaceAll('sauce-labs-', '')}"]`); }
  async sortBy(label: string) { await this.h.selectByLabel('sd.inventory.sort', label); }
  async openProduct(name: string) { await this.h.click('sd.inventory.productByName', { name }); }
  async openCart() { await this.h.click('sd.inventory.cart'); }
}

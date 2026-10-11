import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  async open(): Promise<void> {
    await this.header.openCart();
  }

  itemNames(): Promise<string[]> {
    return this.h.allTextContents('cart.itemNames');
  }

  async setQuantity(quantity: number): Promise<void> {
    await this.h.fill('cart.quantityInput', String(quantity));
    await this.h.click('cart.updateButton');
    await this.settle();
  }

  quantity(): Promise<string> {
    return this.h.locator('cart.quantityInput').first().inputValue();
  }

  async removeFirstItem(): Promise<void> {
    await this.h.click('cart.removeButton');
    await this.settle();
  }

  emptyMessage(): Promise<string> {
    return this.h.textContent('cart.emptyMessage');
  }

  async proceedToCheckout(): Promise<void> {
    await this.h.click('cart.checkoutButton');
    await this.page.waitForURL(/checkout\/checkout|checkout/);
  }
}

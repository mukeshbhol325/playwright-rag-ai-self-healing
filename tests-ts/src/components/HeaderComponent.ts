import type { HealingPage } from '../healing/HealingPage';

/** Site header: cart summary and quick links shown on every page. */
export class HeaderComponent {
  constructor(private readonly h: HealingPage) {}

  cartSummary(): Promise<string> {
    return this.h.textContent('header.cart');
  }

  async openCart(): Promise<void> {
    await this.h.click('header.cartLink');
    await this.h.page.waitForURL(/checkout\/cart|cart/);
  }

  async openCheckout(): Promise<void> {
    await this.h.click('header.checkoutLink');
    await this.h.page.waitForURL(/checkout/);
  }
}

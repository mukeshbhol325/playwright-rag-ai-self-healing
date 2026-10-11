import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  productTitle(): Promise<string> {
    return this.h.textContent('product.title');
  }

  async addToCart(quantity = 1): Promise<void> {
    if (quantity !== 1) await this.h.fill('product.quantity', String(quantity));
    await this.h.click('product.addToCart');
  }
}

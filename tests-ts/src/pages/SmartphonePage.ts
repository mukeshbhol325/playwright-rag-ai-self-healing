import { PATHS } from '../config/constants';
import { BasePage } from './BasePage';

/** Phones & PDAs category listing. */
export class SmartphonePage extends BasePage {
  async open(): Promise<void> {
    await this.goto(PATHS.smartphones);
    await this.h.waitVisible('category.heading');
  }

  heading(): Promise<string> {
    return this.h.textContent('category.heading');
  }

  productNames(): Promise<string[]> {
    return this.h.allTextContents('category.productNames');
  }

  /** Adds whichever phone is listed first and returns its name ("any mobile"). */
  async addFirstPhoneToCart(): Promise<string> {
    const name = (await this.h.textContent('category.firstProductName')).trim();
    await this.h.click('category.firstAddToCart');
    return name;
  }

  async addPhoneToCart(name: string): Promise<void> {
    await this.h.click('category.addToCartByName', { name });
  }

  async openProduct(name: string): Promise<void> {
    await this.h.click('category.productLinkByName', { name });
    await this.page.waitForURL(/product/);
  }
}

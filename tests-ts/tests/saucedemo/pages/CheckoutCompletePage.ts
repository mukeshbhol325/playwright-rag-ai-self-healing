import type { Locator } from '@playwright/test';
import type { HealingPage } from '../../../src/healing/HealingPage';

export class CheckoutCompletePage {
  constructor(private readonly h: HealingPage) {}
  get heading(): Locator { return this.h.page.getByRole('heading', { name: 'Thank you for your order!' }); }
  get backHome(): Locator { return this.h.locator('sd.complete.backHome'); }
  get generatePdf(): Locator { return this.h.page.getByRole('button', { name: 'Generate PDF order' }); }
  message(value: string) { return this.h.page.getByText(value, { exact: true }); }
  async goHome() { await this.h.click('sd.complete.backHome'); }
}

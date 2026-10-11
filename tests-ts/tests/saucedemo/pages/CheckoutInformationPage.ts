import type { Locator } from '@playwright/test';
import type { HealingPage } from '../../../src/healing/HealingPage';

export class CheckoutInformationPage {
  constructor(private readonly h: HealingPage) {}
  get firstName(): Locator { return this.h.locator('sd.info.firstName'); }
  get lastName(): Locator { return this.h.locator('sd.info.lastName'); }
  get postalCode(): Locator { return this.h.locator('sd.info.postalCode'); }
  get continueButton(): Locator { return this.h.locator('sd.info.continue'); }
  get cancel(): Locator { return this.h.locator('sd.info.cancel'); }
  get errorMessage(): Locator { return this.h.page.getByRole('alert'); }
  async fill(first: string, last: string, postal: string) {
    await this.h.fill('sd.info.firstName', first);
    await this.h.fill('sd.info.lastName', last);
    await this.h.fill('sd.info.postalCode', postal);
  }
  async continue() { await this.h.click('sd.info.continue'); }
}

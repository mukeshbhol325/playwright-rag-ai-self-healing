import type { Customer } from '../types/healing';
import { BasePage } from './BasePage';

/** Guest checkout on OpenCart 4.x. */
export class CheckoutPage extends BasePage {
  async fillPersonalDetails(c: Customer): Promise<void> {
    await this.h.fill('checkout.firstName', c.firstName);
    await this.h.fill('checkout.lastName', c.lastName);
    await this.h.fill('checkout.email', c.email);
  }

  async fillShippingAddress(c: Customer): Promise<void> {
    await this.h.fill('checkout.address1', c.address1);
    await this.h.fill('checkout.city', c.city);
    await this.h.fill('checkout.postcode', c.postcode);
    await this.h.selectByLabel('checkout.country', c.country);
    await this.waitForZones();
    await this.h.selectByIndex('checkout.zone', 1);
  }

  async saveCustomerDetails(): Promise<void> {
    await this.h.click('checkout.registerContinue');
    await this.settle();
  }

  async chooseShippingMethod(): Promise<void> {
    await this.h.click('checkout.shippingMethodsButton');
    await this.h.check('checkout.shippingOption');
    await this.h.click('checkout.shippingConfirm');
    await this.settle();
  }

  async choosePaymentMethod(): Promise<void> {
    await this.h.click('checkout.paymentMethodsButton');
    await this.h.check('checkout.paymentOption');
    await this.h.click('checkout.paymentConfirm');
    await this.settle();
  }

  async confirmOrder(): Promise<void> {
    await this.h.click('checkout.confirmOrder');
  }

  /** Complete a guest checkout end to end. */
  async placeGuestOrder(customer: Customer): Promise<void> {
    await this.fillPersonalDetails(customer);
    await this.fillShippingAddress(customer);
    await this.saveCustomerDetails();
    await this.chooseShippingMethod();
    await this.choosePaymentMethod();
    await this.confirmOrder();
  }

  /** Zones are loaded by ajax after the country changes. */
  private async waitForZones(): Promise<void> {
    const zoneSelector = this.h.selectorFor('checkout.zone');
    await this.page.waitForFunction(
      (sel) => document.querySelectorAll(`${sel} option`).length > 1,
      zoneSelector,
      { timeout: 10000 },
    );
  }
}

import { TEXT } from '../../src/config/constants';
import { expect, test } from '../../src/fixtures/test';
import { buildCustomer } from '../../src/utils/testData';

test.describe('Guest checkout', () => {
  test('buys any phone end to end @e2e', async ({ smartphonePage, cartPage, checkoutPage, orderSuccessPage }) => {
    await smartphonePage.open();
    const name = await smartphonePage.addFirstPhoneToCart();

    await cartPage.open();
    expect(await cartPage.itemNames()).toContain(name);
    await cartPage.proceedToCheckout();

    await checkoutPage.placeGuestOrder(buildCustomer());
    expect(await orderSuccessPage.heading()).toContain(TEXT.orderPlaced);
  });
});

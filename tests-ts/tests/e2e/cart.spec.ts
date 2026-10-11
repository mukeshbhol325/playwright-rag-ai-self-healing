import { TEXT } from '../../src/config/constants';
import { expect, test } from '../../src/fixtures/test';

test.describe('Shopping cart', () => {
  test('shows the phone that was added @e2e', async ({ smartphonePage, cartPage }) => {
    await smartphonePage.open();
    const name = await smartphonePage.addFirstPhoneToCart();
    await cartPage.open();
    expect(await cartPage.itemNames()).toContain(name);
  });

  test('updates the quantity @e2e', async ({ smartphonePage, cartPage }) => {
    await smartphonePage.open();
    await smartphonePage.addFirstPhoneToCart();
    await cartPage.open();
    await cartPage.setQuantity(3);
    expect(await cartPage.quantity()).toBe('3');
  });

  test('removes the item and shows an empty cart @e2e', async ({ smartphonePage, cartPage }) => {
    await smartphonePage.open();
    await smartphonePage.addFirstPhoneToCart();
    await cartPage.open();
    await cartPage.removeFirstItem();
    expect(await cartPage.emptyMessage()).toContain(TEXT.cartEmpty);
  });
});

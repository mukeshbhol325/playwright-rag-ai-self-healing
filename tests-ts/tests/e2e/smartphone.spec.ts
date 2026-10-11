import { TEXT } from '../../src/config/constants';
import { expect, test } from '../../src/fixtures/test';

test.describe('Phones & PDAs category', () => {
  test('lists the available phones @e2e', async ({ smartphonePage }) => {
    await smartphonePage.open();
    const names = await smartphonePage.productNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('iPhone');
  });

  test('adds any phone from the listing to the cart @e2e', async ({ smartphonePage }) => {
    await smartphonePage.open();
    const name = await smartphonePage.addFirstPhoneToCart();
    const message = await smartphonePage.alert.successText();
    expect(message).toContain(TEXT.addedToCart);
    expect(message).toContain(name);
  });

  test('adds a named phone (iPhone) from the listing @e2e', async ({ smartphonePage }) => {
    await smartphonePage.open();
    await smartphonePage.addPhoneToCart('iPhone');
    expect(await smartphonePage.alert.successText()).toContain('iPhone');
  });

  test('adds two units from the product page @e2e', async ({ smartphonePage, productPage, cartPage }) => {
    await smartphonePage.open();
    await smartphonePage.openProduct('iPhone');
    expect(await productPage.productTitle()).toContain('iPhone');
    await productPage.addToCart(2);
    expect(await productPage.alert.successText()).toContain(TEXT.addedToCart);

    await cartPage.open();
    expect(await cartPage.itemNames()).toContain('iPhone');
    expect(await cartPage.quantity()).toBe('2');
  });
});

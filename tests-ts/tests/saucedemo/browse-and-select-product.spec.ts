import { test, expect } from '../../src/fixtures/test';
import { LoginPage } from './pages/LoginPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';

test.describe('Browse the catalog, sort products, and inspect a product', () => {
  test('browses, sorts, and opens product details', async ({ page, healer }) => {
    // 1. Sign in and verify the six-product catalog.
    const login = new LoginPage(healer); await login.goto(); await login.login('standard_user', 'secret_sauce');
    const inventory = new InventoryPage(healer); await expect(inventory.title).toHaveText('Products');
    for (const name of ['Sauce Labs Backpack', 'Sauce Labs Bike Light', 'Sauce Labs Bolt T-Shirt', 'Sauce Labs Fleece Jacket', 'Sauce Labs Onesie', 'Test.allTheThings() T-Shirt (Red)']) await expect(inventory.product(name)).toBeVisible();
    // 2. Change the product sort order.
    await inventory.sortBy('Name (Z to A)'); await expect(inventory.sortProducts).toHaveValue('za');
    // 3. Inspect the backpack.
    await inventory.openProduct('Sauce Labs Backpack'); const details = new ProductDetailsPage(healer);
    await expect(details.productName('Sauce Labs Backpack')).toBeVisible(); await expect(details.price('$29.99')).toBeVisible(); await expect(details.addToCart).toBeVisible();
    // 4. Return, inspect another product, and return to the catalog.
    await details.back(); await inventory.openProduct('Sauce Labs Bike Light'); await expect(details.productName('Sauce Labs Bike Light')).toBeVisible(); await details.back();
    await expect(inventory.title).toHaveText('Products');
  });
});
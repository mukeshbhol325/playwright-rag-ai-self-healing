import { test, expect } from '../../src/fixtures/test';
import { LoginPage } from './pages/LoginPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { CartPage } from './pages/CartPage';

test.describe('Add, review, and remove an item from the cart', () => {
  test('manages two products and empties the cart', async ({ page, healer }) => {
    // 1. Add the backpack and verify the cart count.
    const login = new LoginPage(healer); await login.goto(); await login.login('standard_user', 'secret_sauce'); const inventory = new InventoryPage(healer);
    await inventory.openProduct('Sauce Labs Backpack'); const details = new ProductDetailsPage(healer); await details.addItem(); await expect(inventory.cartButton).toHaveAccessibleName(/Cart, 1 items/);
    // 2. Review the cart.
    await inventory.openCart(); const cart = new CartPage(healer); await expect(cart.item('Sauce Labs Backpack')).toBeVisible(); await expect(cart.item('$29.99')).toBeVisible(); await expect(cart.continueShopping).toBeVisible(); await expect(cart.checkout).toBeVisible();
    // 3. Continue shopping and add a second product.
    await cart.continueShoppingAction(); await inventory.openProduct('Sauce Labs Bike Light'); await details.addItem(); await inventory.openCart();
    await expect(cart.item('Sauce Labs Backpack')).toBeVisible(); await expect(cart.item('Sauce Labs Bike Light')).toBeVisible();
    // 4. Remove one item.
    await cart.removeItem('Sauce Labs Bike Light'); await expect(cart.item('Sauce Labs Bike Light')).not.toBeVisible(); await expect(page.getByRole('button', { name: /Cart, 1 items/ })).toBeVisible();
    // 5. Remove the final item.
    await cart.removeItem('Sauce Labs Backpack'); await expect(page.getByRole('button', { name: /Cart, empty/ })).toBeVisible(); await expect(cart.item('Sauce Labs Backpack')).not.toBeVisible();
  });
});
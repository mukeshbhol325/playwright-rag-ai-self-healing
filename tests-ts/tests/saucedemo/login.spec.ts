import { test, expect } from '../../src/fixtures/test';
import { LoginPage } from './pages/LoginPage';
import { InventoryPage } from './pages/InventoryPage';

test.describe('Sign in with valid and invalid credentials', () => {
  test('rejects invalid credentials and signs in with valid credentials', async ({ page, healer }) => {
    // 1. Enter invalid credentials and submit Login.
    const login = new LoginPage(healer); await login.goto(); await login.login('invalid_user', 'invalid_password');
    await expect(login.errorMessage).toContainText('Username and password do not match');
    await expect(page).toHaveURL(/saucedemo\.com\/$/);
    // 2. Replace them with valid credentials and sign in.
    await login.login('standard_user', 'secret_sauce'); const inventory = new InventoryPage(healer);
    await expect(page).toHaveURL(/inventory\.html$/); await expect(inventory.title).toHaveText('Products');
    await expect(inventory.cartButton).toHaveAccessibleName(/Cart, empty/); await expect(inventory.sortProducts).toBeVisible();
    // 3. Reload the inventory page.
    await page.reload(); await expect(inventory.title).toHaveText('Products');
  });
});
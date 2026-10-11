import { test, expect } from '../../src/fixtures/test';
import { LoginPage } from './pages/LoginPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { CartPage } from './pages/CartPage';
import { CheckoutInformationPage } from './pages/CheckoutInformationPage';

test.describe('Enter and validate checkout information', () => {
  test('validates required fields before continuing', async ({ page, healer }) => {
    // 1. Add the backpack and open checkout.
    const login = new LoginPage(healer); await login.goto(); await login.login('standard_user', 'secret_sauce'); const inventory = new InventoryPage(healer); await inventory.openProduct('Sauce Labs Backpack'); await new ProductDetailsPage(healer).addItem(); await inventory.openCart(); await new CartPage(healer).checkoutAction();
    const checkout = new CheckoutInformationPage(healer); await expect(checkout.firstName).toBeVisible(); await expect(checkout.lastName).toBeVisible(); await expect(checkout.postalCode).toBeVisible();
    // 2. Submit blank fields.
    await checkout.continue(); await expect(checkout.errorMessage).toContainText('First Name is required');
    // 3. Submit only the first name.
    await checkout.firstName.fill('Test'); await checkout.continue(); await expect(checkout.errorMessage).toContainText('Last Name is required');
    // 4. Complete the form.
    await checkout.fill('Test', 'Customer', '12345'); await checkout.continue(); await expect(page).toHaveURL(/checkout-step-two\.html$/); await expect(page.getByText('Checkout: Overview', { exact: true })).toBeVisible(); await expect(page.getByText('Finish', { exact: true })).toBeVisible();
  });
});
import { test, expect } from '../../src/fixtures/test';
import { LoginPage } from './pages/LoginPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { CartPage } from './pages/CartPage';
import { CheckoutInformationPage } from './pages/CheckoutInformationPage';
import { CheckoutOverviewPage } from './pages/CheckoutOverviewPage';
import { CheckoutCompletePage } from './pages/CheckoutCompletePage';

async function reachOverview(page: import('@playwright/test').Page, healer: import('../../src/healing/HealingPage').HealingPage) {
  const login = new LoginPage(healer); const inventory = new InventoryPage(healer); await page.goto('https://www.saucedemo.com/inventory.html');
  if (await login.loginButton.isVisible()) await login.login('standard_user', 'secret_sauce');
  await inventory.openProduct('Sauce Labs Backpack'); await new ProductDetailsPage(healer).addItem(); await inventory.openCart(); await new CartPage(healer).checkoutAction(); const info = new CheckoutInformationPage(healer); await info.fill('Test', 'Customer', '12345'); await info.continue(); return new CheckoutOverviewPage(healer);
}

test.describe('Review totals and complete an order', () => {
  test('cancels from review and completes an independent order', async ({ page, healer }) => {
    // 1. Review the backpack order totals and fulfillment details.
    let overview = await reachOverview(page, healer); await expect(overview.text('Sauce Labs Backpack')).toBeVisible(); await expect(overview.text('Item total: $29.99')).toBeVisible(); await expect(overview.text('Tax: $2.40')).toBeVisible(); await expect(overview.text('Total: $32.39')).toBeVisible(); await expect(overview.text('SauceCard #31337')).toBeVisible(); await expect(overview.text('Free Pony Express Delivery!')).toBeVisible();
    // 2. Cancel without placing the order.
    await overview.cancelOrder(); await expect(page).not.toHaveURL(/checkout-complete\.html$/); await expect(page.getByText('Thank you for your order!', { exact: true })).not.toBeVisible();
    const inventoryAfterCancel = new InventoryPage(healer); await inventoryAfterCancel.openCart(); const cartAfterCancel = new CartPage(healer); await cartAfterCancel.removeItem('Sauce Labs Backpack');
    // 3. Independently repeat setup and finish the order.
    overview = await reachOverview(page, healer); await overview.finishOrder(); const complete = new CheckoutCompletePage(healer); await expect(page).toHaveURL(/checkout-complete\.html$/); await expect(complete.heading).toBeVisible(); await expect(complete.message('Your order has been dispatched, and will arrive just as fast as the pony can get there!')).toBeVisible(); await expect(complete.backHome).toBeVisible(); await expect(complete.generatePdf).toBeVisible(); await expect(page.getByRole('button', { name: /Cart, empty/ })).toBeVisible();
    // 4. Return home.
    await complete.goHome(); await expect(page).toHaveURL(/inventory\.html$/); await expect(page.getByText('Products', { exact: true })).toBeVisible();
  });
});
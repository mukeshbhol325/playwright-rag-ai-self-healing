/**
 * Locator-drift simulation for demos.
 *
 * The live OpenCart demo does not change its markup on demand, so to show healing
 * we replace chosen registry selectors with realistic "stale" ones, i.e. what a
 * dev's older locator might look like after a UI refactor. The healer must then
 * find the real element from the live DOM.
 */
export const STALE_SELECTORS: Record<string, string> = {
  'category.firstAddToCart': 'button.btn-add-to-basket-v1',
  'product.addToCart': '#btn-add-product-to-basket',
  'checkout.firstName': '#customer-first-name',
  'checkout.email': '#customer-email',
  'checkout.address1': '#customer-address',
  'checkout.registerContinue': '#btn-register-continue',
  'checkout.confirmOrder': '#btn-confirm-order',
  'sd.login.username': '#user-name-field',
  'sd.login.password': '#password-input',
  'sd.login.button': '#login-submit-button',
};

export const DEFAULT_DRIFT_KEYS = Object.keys(STALE_SELECTORS);

export function staleSelectorFor(key: string): string | undefined {
  return STALE_SELECTORS[key];
}

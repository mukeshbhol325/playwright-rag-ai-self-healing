export const PATHS = {
  home: '/',
  smartphones: '/en-gb/catalog/smartphone',
} as const;

export const TEXT = {
  homeTitle: 'Your Store',
  orderPlaced: 'Your order has been placed!',
  cartEmpty: 'Your shopping cart is empty!',
  addedToCart: 'You have added',
} as const;

/** Healer endpoints; keep in sync with healer-service/app/api. */
export const HEALER_API = {
  heal: '/heal',
  feedback: '/feedback',
  failures: '/failures',
  health: '/health',
} as const;

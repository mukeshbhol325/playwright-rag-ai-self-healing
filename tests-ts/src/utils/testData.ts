import customerTemplate from '../../test-data/customer.json';
import type { Customer } from '../types/healing';

/** A guest customer with a unique e-mail, so repeated runs never collide. */
export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { ...customerTemplate, email: `qa.${unique}@example.com`, ...overrides };
}

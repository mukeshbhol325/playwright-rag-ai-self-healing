import type { Locator } from '@playwright/test';
import type { HealingPage } from '../../../src/healing/HealingPage';

export class LoginPage {
  constructor(private readonly h: HealingPage) {}
  get username(): Locator { return this.h.locator('sd.login.username'); }
  get password(): Locator { return this.h.locator('sd.login.password'); }
  get loginButton(): Locator { return this.h.locator('sd.login.button'); }
  get errorMessage(): Locator { return this.h.page.getByRole('alert'); }
  async goto() { await this.h.page.goto('https://www.saucedemo.com'); }
  async login(username: string, password: string) {
    await this.h.fill('sd.login.username', username);
    await this.h.fill('sd.login.password', password);
    await this.h.click('sd.login.button');
  }
}

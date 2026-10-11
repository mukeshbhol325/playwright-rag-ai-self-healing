import { BasePage } from './BasePage';

export class OrderSuccessPage extends BasePage {
  async heading(): Promise<string> {
    await this.page.waitForURL(/checkout\/success|success/, { timeout: 30000 });
    return (await this.h.textContent('success.heading')).trim();
  }
}

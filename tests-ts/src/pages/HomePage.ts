import { PATHS } from '../config/constants';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  async open(): Promise<void> {
    await this.goto(PATHS.home);
  }

  async searchFor(term: string): Promise<void> {
    await this.h.fill('home.searchInput', term);
    await this.h.click('home.searchButton');
    await this.page.waitForURL(/search/);
  }

  searchResultNames(): Promise<string[]> {
    return this.h.allTextContents('search.resultNames');
  }

  async openPhonesFromMenu(): Promise<void> {
    await this.h.click('home.menuPhones');
    await this.page.waitForURL(/smartphone/);
  }
}

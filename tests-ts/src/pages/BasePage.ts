import type { Page } from '@playwright/test';
import { AlertComponent } from '../components/AlertComponent';
import { HeaderComponent } from '../components/HeaderComponent';
import type { HealingPage } from '../healing/HealingPage';

export abstract class BasePage {
  readonly header: HeaderComponent;
  readonly alert: AlertComponent;

  constructor(protected readonly h: HealingPage) {
    this.header = new HeaderComponent(h);
    this.alert = new AlertComponent(h);
  }

  protected get page(): Page {
    return this.h.page;
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  title(): Promise<string> {
    return this.page.title();
  }

  url(): string {
    return this.page.url();
  }

  /** Best-effort wait for ajax-driven sections to settle. */
  protected async settle(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  }
}

import type { HealingPage } from '../healing/HealingPage';

/** Toast alerts shown after ajax actions such as add-to-cart. */
export class AlertComponent {
  constructor(private readonly h: HealingPage) {}

  async successText(): Promise<string> {
    return (await this.h.textContent('alert.success')).replace(/\s+/g, ' ').trim();
  }
}

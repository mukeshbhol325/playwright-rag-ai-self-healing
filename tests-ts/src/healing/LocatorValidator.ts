import type { Page } from '@playwright/test';
import type { HealAction } from '../types/healing';

export interface Validation {
  ok: boolean;
  reason: string;
}

/**
 * Never trust a suggestion blindly: a candidate is accepted only if, in the live
 * page, it resolves to exactly one visible element that can perform the action.
 */
export class LocatorValidator {
  async validate(page: Page, selector: string, action: HealAction): Promise<Validation> {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count === 0) return { ok: false, reason: 'no element matches' };
      if (count > 1) return { ok: false, reason: `ambiguous: ${count} elements match` };
      if (!(await locator.isVisible())) return { ok: false, reason: 'element is not visible' };

      const info = await locator.evaluate((el) => {
        const input = el as HTMLInputElement;
        return {
          tag: el.tagName.toLowerCase(),
          type: (input.type ?? '').toLowerCase(),
          disabled: input.disabled === true,
          editable: (el as HTMLElement).isContentEditable,
        };
      });

      switch (action) {
        case 'fill': {
          const fillable =
            info.tag === 'textarea' ||
            info.editable ||
            (info.tag === 'input' && !['checkbox', 'radio', 'submit', 'button', 'hidden', 'file', 'image'].includes(info.type));
          return fillable && !info.disabled ? { ok: true, reason: 'ok' } : { ok: false, reason: 'element cannot be filled' };
        }
        case 'select':
          return info.tag === 'select' && !info.disabled ? { ok: true, reason: 'ok' } : { ok: false, reason: 'not a <select>' };
        case 'check':
          return info.tag === 'input' && ['checkbox', 'radio'].includes(info.type) && !info.disabled
            ? { ok: true, reason: 'ok' }
            : { ok: false, reason: 'not a checkbox/radio' };
        case 'click':
          return info.disabled ? { ok: false, reason: 'element is disabled' } : { ok: true, reason: 'ok' };
        default:
          return { ok: true, reason: 'ok' };
      }
    } catch (err) {
      return { ok: false, reason: `invalid selector: ${(err as Error).message.split('\n')[0]}` };
    }
  }
}

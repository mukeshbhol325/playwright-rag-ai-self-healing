import type { Page } from '@playwright/test';
import { env } from '../config/env';

/**
 * Captures a compact, privacy-scrubbed HTML snapshot of the page body.
 * Scripts, styles and SVGs are removed, and values of sensitive inputs are
 * stripped, so nothing secret leaves the test machine.
 */
export async function captureDom(page: Page, maxChars: number = env.maxDomChars): Promise<string> {
  const html = await page.evaluate(() => {
    const body = document.body.cloneNode(true) as HTMLElement;
    body.querySelectorAll('script,style,noscript,svg,link,meta,iframe,template').forEach((n) => n.remove());
    body.querySelectorAll('input,textarea').forEach((n) => {
      const type = (n.getAttribute('type') ?? 'text').toLowerCase();
      if (['text', 'email', 'password', 'tel', 'search', 'number'].includes(type) || n.tagName === 'TEXTAREA') {
        n.removeAttribute('value');
        if (n.tagName === 'TEXTAREA') n.textContent = '';
      }
    });
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
    const comments: Node[] = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach((c) => c.parentNode?.removeChild(c));
    return body.outerHTML;
  });
  return html.replace(/\s+/g, ' ').slice(0, maxChars);
}

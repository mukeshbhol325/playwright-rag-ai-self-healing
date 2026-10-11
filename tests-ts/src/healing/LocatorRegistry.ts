import * as fs from 'fs';
import * as path from 'path';
import locatorFile from '../locators/locators.json';
import { env } from '../config/env';
import { staleSelectorFor } from '../utils/drift';
import { createLogger } from '../utils/logger';
import type { HealCandidate } from '../types/healing';

const log = createLogger('registry');

export type ResolveSource = 'registry' | 'healed-cache' | 'drift';

export interface Resolved {
  selector: string;
  source: ResolveSource;
}

export interface HealedEntry {
  key: string;
  original: string;
  healed: string;
  confidence: number;
  source: HealCandidate['source'];
  healedAt: string;
  count: number;
}

export interface RegistryOptions {
  /** Keys whose selectors are deliberately replaced with stale ones (demo). */
  driftKeys: string[];
  useHealedCache: boolean;
  cacheFile?: string;
}

const CACHE_FILE = path.join(env.reportDir, 'healed-locators.json');

/**
 * Single source of truth for selectors. Page objects reference *keys*, never raw
 * selectors, so a locator change is a one-line edit in locators.json, and healed
 * replacements are recorded here as reviewable suggestions.
 */
export class LocatorRegistry {
  private readonly base = locatorFile as Record<string, string>;
  private healed: Record<string, HealedEntry> = {};
  private readonly sessionHeals = new Map<string, string>();
  private readonly cacheFile: string;

  constructor(private readonly opts: RegistryOptions) {
    this.cacheFile = opts.cacheFile ?? CACHE_FILE;
    this.loadCache();
  }

  has(key: string): boolean {
    return key in this.base;
  }

  resolve(key: string, params: Record<string, string> = {}): Resolved {
    const template = this.base[key];
    if (template === undefined) {
      throw new Error(`Unknown locator key '${key}'. Add it to src/locators/locators.json`);
    }
    let selector = this.interpolate(template, params);
    let source: ResolveSource = 'registry';

    const stale = this.opts.driftKeys.includes(key) ? staleSelectorFor(key) : undefined;
    if (stale) {
      selector = stale;
      source = 'drift';
    }
    const sessionHealed = this.sessionHeals.get(selector);
    if (sessionHealed) {
      return { selector: sessionHealed, source: 'healed-cache' };
}
    // The cache maps a *broken* selector to the replacement that worked before.
    const cached = this.opts.useHealedCache ? this.healed[selector] : undefined;
    if (cached) {
      return { selector: cached.healed, source: 'healed-cache' };
    }
    return { selector, source };
  }

  recordHeal(key: string, original: string, candidate: HealCandidate): void {
    this.sessionHeals.set(original, candidate.selector);
    const previous = this.healed[original];
    this.healed[original] = {
      key,
      original,
      healed: candidate.selector,
      confidence: candidate.confidence,
      source: candidate.source,
      healedAt: new Date().toISOString(),
      count: (previous?.count ?? 0) + 1,
    };
    this.persist();
  }

  private interpolate(template: string, params: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = params[name];
      if (value === undefined) throw new Error(`Missing parameter '${name}' for locator '${template}'`);
      return value.replace(/"/g, '\\"');
    });
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        this.healed = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')) as Record<string, HealedEntry>;
      }
    } catch (err) {
      log.warn(`Could not read healed cache: ${(err as Error).message}`);
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      // Re-read before writing so entries from other workers are not lost.
      const onDisk = fs.existsSync(this.cacheFile)
        ? (JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')) as Record<string, HealedEntry>)
        : {};
      fs.writeFileSync(this.cacheFile, JSON.stringify({ ...onDisk, ...this.healed }, null, 2));
    } catch (err) {
      log.warn(`Could not persist healed locators: ${(err as Error).message}`);
    }
  }
}

import * as fs from 'fs';
import * as path from 'path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { HealerClient } from '../api/HealerClient';
import { env } from '../config/env';
import type { FailureAnalysis, FailureReport, HealingEvent } from '../types/healing';

const ANSI = /\u001b\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI, '');

interface AnalysedFailure {
  report: FailureReport;
  analysis: FailureAnalysis | null;
}

/**
 * Custom Playwright reporter.
 *
 * During the run it collects (a) healing events attached by HealingPage and
 * (b) test failures. When the run ends it POSTs each final failure to the healer
 * service (/failures) for classification + root-cause hints, then writes
 * reports/healing/healing-report.{json,md}. It can also fail the build when too
 * many locators were healed (MAX_HEALS), so healing is never a silent pass.
 */
export default class HealingReporter implements Reporter {
  private events: HealingEvent[] = [];
  private failures: FailureReport[] = [];
  private total = 0;

  onTestEnd(test: TestCase, result: TestResult): void {
    this.total++;
    for (const attachment of result.attachments) {
      if (attachment.name === 'healing-events.json' && attachment.body) {
        try {
          this.events.push(...(JSON.parse(attachment.body.toString()) as HealingEvent[]));
        } catch {
          /* ignore malformed attachment */
        }
      }
    }

    const failed = result.status === 'failed' || result.status === 'timedOut';
    if (failed && result.retry >= test.retries) {
      const error = stripAnsi(result.error?.message ?? result.error?.stack ?? '');
      this.failures.push({
        test_name: test.titlePath().slice(3).join(' › '),
        file: path.relative(process.cwd(), test.location.file),
        status: result.status,
        error,
        duration_ms: result.duration,
        retry: result.retry,
        failed_selector: /locator\((['"`])(.+?)\1\)/.exec(error)?.[2] ?? null,
      });
    }
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    const healed = this.events.filter((e) => e.status === 'healed');
    const failedHeals = this.events.filter((e) => e.status === 'failed' || e.status === 'skipped');

    const analysed: AnalysedFailure[] = [];
    if (this.failures.length > 0) {
      const client = new HealerClient();
      const reachable = await client.isHealthy();
      for (const report of this.failures) {
        analysed.push({ report, analysis: reachable ? await client.reportFailure(report) : null });
      }
    }

    this.write(result, healed, failedHeals, analysed);
    this.printSummary(healed, failedHeals, analysed);

    if (env.maxHeals >= 0 && healed.length > env.maxHeals) {
      console.error(`\n[healing] ${healed.length} locators were healed, above MAX_HEALS=${env.maxHeals}. Failing the run.`);
      return { status: 'failed' };
    }
    return undefined;
  }

  private write(result: FullResult, healed: HealingEvent[], failedHeals: HealingEvent[], analysed: AnalysedFailure[]): void {
    fs.mkdirSync(env.reportDir, { recursive: true });
    const summary = {
      status: result.status,
      tests: this.total,
      healedLocators: healed.length,
      failedHealAttempts: failedHeals.length,
      failedTests: this.failures.length,
    };
    fs.writeFileSync(
      path.join(env.reportDir, 'healing-report.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), summary, events: this.events, failures: analysed }, null, 2),
    );

    const md: string[] = ['# Self-healing report', '', `Run status: **${result.status}**, tests: ${this.total}`, ''];
    md.push(`- Healed locators: **${healed.length}**`, `- Failed/skipped heal attempts: ${failedHeals.length}`, `- Failed tests: ${this.failures.length}`, '');
    if (healed.length) {
      md.push('## Healed locators (review and update locators.json)', '', '| Key | Original | Healed | Confidence | Source |', '|---|---|---|---|---|');
      for (const e of healed) md.push(`| ${e.locatorKey} | \`${e.originalSelector}\` | \`${e.healedSelector}\` | ${e.confidence} | ${e.source} |`);
      md.push('');
    }
    if (analysed.length) {
      md.push('## Failure analysis', '');
      for (const { report, analysis } of analysed) {
        md.push(`### ${report.test_name}`, `- File: ${report.file}`);
        md.push(analysis ? `- Category: **${analysis.category}**\n- Summary: ${analysis.summary}\n- Suggested fix: ${analysis.suggested_fix}` : '- Analysis unavailable (healer service not reachable)', '');
      }
    }
    fs.writeFileSync(path.join(env.reportDir, 'healing-report.md'), md.join('\n'));
  }

  private printSummary(healed: HealingEvent[], failedHeals: HealingEvent[], analysed: AnalysedFailure[]): void {
    console.log('\n──────── Self-healing summary ────────');
    console.log(`Healed locators: ${healed.length}   Failed/skipped heal attempts: ${failedHeals.length}`);
    for (const e of healed) console.log(`  ✔ ${e.locatorKey}: ${e.originalSelector} → ${e.healedSelector} (${e.confidence}, ${e.source})`);
    for (const { report, analysis } of analysed) {
      console.log(`  ✘ ${report.test_name}: ${analysis ? `${analysis.category} - ${analysis.suggested_fix}` : 'no analysis'}`);
    }
    console.log(`Report: ${path.relative(process.cwd(), env.reportDir)}/healing-report.md\n`);
  }
}

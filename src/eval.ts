import { argv } from 'node:process';
import { pathToFileURL } from 'node:url';
import { runReport } from './agent';
import type { Verdict } from './checks';
import { assertProviderKeys, getConfig } from './config';
import { sql } from './db/client';
import { DEFAULT_THRESHOLD, GOLDEN, GOLDEN_COMPANIES } from './golden';
import { ingestAll } from './ingest';
import { judge } from './judge';

/**
 * Eval harness (M4) — the headline. Runs the agent over the reference companies
 * and scores every finding against the golden set with an LLM-as-judge (Claude
 * when JUDGE_PROVIDER=anthropic; a deterministic verdict-match judge otherwise).
 * Produces a pass/fail summary. `runEval()` assumes the corpus is ingested; the
 * CLI (`npm run eval` / `make eval`) ingests first, prints a table, and exits
 * non-zero below threshold so CI can gate on it.
 */
export interface EvalRow {
  company: string;
  checkId: string;
  expected: Verdict;
  actual: Verdict | 'missing';
  pass: boolean;
  reason: string;
}

export interface EvalReport {
  rows: EvalRow[];
  passes: number;
  total: number;
  score: number;
  threshold: number;
  passed: boolean;
}

export async function runEval(): Promise<EvalReport> {
  const rows: EvalRow[] = [];
  for (const company of GOLDEN_COMPANIES) {
    const report = await runReport(company);
    const byId = new Map(report.findings.map((f) => [f.checkId, f]));
    for (const item of GOLDEN.filter((g) => g.company === company)) {
      const finding = byId.get(item.checkId);
      const verdict = await judge(item, finding);
      rows.push({
        company,
        checkId: item.checkId,
        expected: item.expected,
        actual: finding?.verdict ?? 'missing',
        pass: verdict.pass,
        reason: verdict.reason,
      });
    }
  }
  const passes = rows.filter((r) => r.pass).length;
  const total = rows.length;
  const score = total === 0 ? 0 : passes / total;
  const threshold = getConfig().EVAL_THRESHOLD ?? DEFAULT_THRESHOLD;
  return { rows, passes, total, score, threshold, passed: score >= threshold };
}

const short = (s: string, n = 22): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function printReport(report: EvalReport): void {
  const { LLM_PROVIDER: reasoning, JUDGE_PROVIDER: judgeProvider } = getConfig();
  console.log(
    `\n  AI Due Diligence — evaluation   [reasoning: ${reasoning}, judge: ${judgeProvider}]\n`,
  );
  console.log(
    `  ${'Company'.padEnd(22)} ${'Check'.padEnd(22)} ${'Expected'.padEnd(9)} ${'Actual'.padEnd(9)}`,
  );
  for (const row of report.rows) {
    console.log(
      `  ${short(row.company).padEnd(22)} ${row.checkId.padEnd(22)} ` +
        `${row.expected.padEnd(9)} ${String(row.actual).padEnd(9)} ${row.pass ? '✓' : '✗'}`,
    );
  }
  const pct = Math.round(report.score * 100);
  console.log(
    `\n  Score: ${report.passes}/${report.total} (${pct}%)  —  ${report.passed ? 'PASS' : 'FAIL'} ` +
      `(threshold ${Math.round(report.threshold * 100)}%)\n`,
  );
}

async function main(): Promise<void> {
  // The eval ingests (embed + extract), reasons every check, and judges.
  assertProviderKeys('embed', 'extract', 'llm', 'judge');
  await ingestAll(); // idempotent; respects EMBED_PROVIDER (local for `make eval`)
  const report = await runEval();
  printReport(report);
  if (!report.passed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  try {
    await main();
  } finally {
    await sql.end();
  }
}

import { runReport } from './agent';
import type { Finding, Verdict } from './checks';
import { sql } from './db/client';
import { getExtractions, listCompanies } from './db/search';

/**
 * Milestone demo (M3): run the due-diligence agent over every ingested company
 * and print a readable, cited audit report — flagged vs clear across the corpus.
 * Run via `make demo` (keyless: EMBED_PROVIDER=local, LLM_PROVIDER=local). The
 * same data flows through `GET /report/:company` as structured JSON.
 */
const MARK: Record<Verdict, string> = { flagged: '⚑', clear: '✓', uncertain: '?' };

function renderFinding(finding: Finding): void {
  console.log(
    `    ${MARK[finding.verdict]} ${finding.label.padEnd(26)} ` +
      `${finding.verdict.toUpperCase().padEnd(9)} ${finding.summary}`,
  );
  // Show the evidence for anything flagged — that's the audit-grade citation.
  const top = finding.citations[0];
  if (finding.verdict === 'flagged' && top) {
    const snippet = top.snippet.length > 108 ? `${top.snippet.slice(0, 108)}…` : top.snippet;
    console.log(`        ↳ ${top.company} · ${top.sourceType} #${top.ordinal}  “${snippet}”`);
  }
}

async function main(): Promise<void> {
  const reasoning =
    process.env.LLM_PROVIDER === 'local'
      ? 'local heuristic (keyless)'
      : 'anthropic · claude-sonnet-4-6';
  console.log(`\n  AI Due Diligence — audit report demo   [reasoning: ${reasoning}]`);
  if (process.env.LLM_PROVIDER === 'local') {
    console.log(
      '  (heuristic stand-in — set ANTHROPIC_API_KEY and LLM_PROVIDER=anthropic for the model)',
    );
  }
  console.log('');

  const companies = (await listCompanies()).sort();
  if (companies.length === 0) {
    console.log('  (no data — run `make demo`, or `npm run ingest` first)\n');
    return;
  }

  for (const company of companies) {
    const report = await runReport(company);
    const flags = report.findings.filter((f) => f.verdict === 'flagged').length;
    console.log(`  ═══ ${company} ═══   (${flags} flag${flags === 1 ? '' : 's'})`);
    for (const finding of report.findings) renderFinding(finding);
    await renderExtraction(company);
    console.log('');
  }
}

/**
 * Print the structured fields extracted (M6) from the company's PDF filing
 * summary — the "front half" that turns unstructured filing text into typed data.
 */
async function renderExtraction(company: string): Promise<void> {
  const docs = await getExtractions(company);
  const source =
    docs.find((d) => d.sourceType === 'filing-summary') ?? docs.find((d) => d.extraction);
  const e = source?.extraction;
  if (!e) return;
  const parts: string[] = [];
  const { largestCustomer, largestCustomerPct } = e.revenueConcentration;
  if (largestCustomerPct !== null) {
    parts.push(`largest customer ${largestCustomer ?? '?'} ${largestCustomerPct}%`);
  }
  if (e.relatedParties.length > 0) {
    parts.push(`related party ${e.relatedParties.map((r) => r.counterparty).join(', ')}`);
  }
  if (e.goingConcern.substantialDoubt) parts.push('going-concern doubt');
  if (e.auditor.changed) parts.push(`auditor changed → ${e.auditor.auditorName ?? '?'}`);
  else if (e.auditor.auditorName) parts.push(`auditor ${e.auditor.auditorName}`);
  console.log(
    `    ⤷ extracted from PDF: ${parts.length > 0 ? parts.join(' · ') : '(no salient fields)'}`,
  );
}

try {
  await main();
} finally {
  await sql.end();
}

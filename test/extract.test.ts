import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Extraction } from '../src/extract';
import { extract } from '../src/extract';
import { EXTRACTION_F1_THRESHOLD, GOLDEN_EXTRACTIONS } from '../src/golden-extract';
import { decodePdf } from '../src/pdf';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/**
 * Flatten an extraction into a set of atomic "facts" — non-null scalars, true
 * booleans, and related-party counterparties. Nulls / false / empty arrays are
 * negatives and produce no fact, so inventing one shows up as a false positive.
 * Facts are namespaced by company so identical values across companies don't merge.
 */
function factsOf(
  slug: string,
  e: Pick<Extraction, 'revenueConcentration' | 'relatedParties' | 'goingConcern' | 'auditor'>,
): Set<string> {
  const facts = new Set<string>();
  const add = (s: string): void => void facts.add(`${slug}:${s}`);
  if (e.revenueConcentration.largestCustomerPct !== null) {
    add(`concPct=${e.revenueConcentration.largestCustomerPct}`);
  }
  if (e.revenueConcentration.largestCustomer !== null) {
    add(`concCustomer=${e.revenueConcentration.largestCustomer}`);
  }
  if (e.goingConcern.substantialDoubt) add('goingConcernDoubt=true');
  if (e.auditor.changed) add('auditorChanged=true');
  if (e.auditor.auditorName !== null) add(`auditorName=${e.auditor.auditorName}`);
  for (const rp of e.relatedParties) add(`relatedParty=${rp.counterparty}`);
  return facts;
}

describe('structured extraction (EXTRACT_PROVIDER=local)', () => {
  beforeAll(() => {
    process.env.EXTRACT_PROVIDER = 'local';
    process.env.PDF_PROVIDER = 'local';
  });

  // Per-company: the extraction from the PDF must reproduce every planted fact.
  for (const golden of GOLDEN_EXTRACTIONS) {
    it(`extracts the planted fields from ${golden.slug}/filing-summary.pdf`, async () => {
      const bytes = new Uint8Array(
        await readFile(join(FIXTURES_DIR, golden.slug, 'filing-summary.pdf')),
      );
      const text = await decodePdf(bytes);
      expect(text).not.toBe('');

      const actual = await extract(text);
      const expectedFacts = factsOf(golden.slug, golden.expected);
      const actualFacts = factsOf(golden.slug, actual);

      // Every planted fact is found, and nothing spurious is invented.
      for (const fact of expectedFacts) expect(actualFacts).toContain(fact);
      expect([...actualFacts].sort()).toEqual([...expectedFacts].sort());
    });
  }

  // Corpus-level precision/recall/F1 — the headline extraction metric.
  it(`scores extraction F1 >= ${EXTRACTION_F1_THRESHOLD} across the corpus`, async () => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const golden of GOLDEN_EXTRACTIONS) {
      const bytes = new Uint8Array(
        await readFile(join(FIXTURES_DIR, golden.slug, 'filing-summary.pdf')),
      );
      const actual = await extract(await decodePdf(bytes));
      const expected = factsOf(golden.slug, golden.expected);
      const predicted = factsOf(golden.slug, actual);
      for (const f of predicted) {
        if (expected.has(f)) tp++;
        else fp++;
      }
      for (const f of expected) {
        if (!predicted.has(f)) fn++;
      }
    }
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = (2 * precision * recall) / (precision + recall || 1);
    expect(f1).toBeGreaterThanOrEqual(EXTRACTION_F1_THRESHOLD);
  });
});

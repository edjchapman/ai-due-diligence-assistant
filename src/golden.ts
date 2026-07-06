import type { Verdict } from './checks';

/** One expected outcome: the ground-truth verdict for a (company, check) pair. */
export interface GoldenItem {
  company: string;
  checkId: string;
  expected: Verdict;
}

/**
 * The golden set — the signals deliberately planted in the fixtures, encoded as
 * ground truth. The eval harness scores the agent's findings against these.
 * Kept in sync with fixtures/: Northwind (concentration + auditor change),
 * Helios (going-concern + related-party), Meridian (clean control — all clear).
 */
export const GOLDEN: GoldenItem[] = [
  { company: 'Northwind Materials Inc.', checkId: 'revenue-concentration', expected: 'flagged' },
  { company: 'Northwind Materials Inc.', checkId: 'related-party', expected: 'clear' },
  { company: 'Northwind Materials Inc.', checkId: 'going-concern', expected: 'clear' },
  { company: 'Northwind Materials Inc.', checkId: 'auditor-change', expected: 'flagged' },

  { company: 'Helios Robotics Corp.', checkId: 'revenue-concentration', expected: 'clear' },
  { company: 'Helios Robotics Corp.', checkId: 'related-party', expected: 'flagged' },
  { company: 'Helios Robotics Corp.', checkId: 'going-concern', expected: 'flagged' },
  { company: 'Helios Robotics Corp.', checkId: 'auditor-change', expected: 'clear' },

  { company: 'Meridian Foods PLC', checkId: 'revenue-concentration', expected: 'clear' },
  { company: 'Meridian Foods PLC', checkId: 'related-party', expected: 'clear' },
  { company: 'Meridian Foods PLC', checkId: 'going-concern', expected: 'clear' },
  { company: 'Meridian Foods PLC', checkId: 'auditor-change', expected: 'clear' },
];

/** Companies present in the golden set, in stable order. */
export const GOLDEN_COMPANIES: string[] = [...new Set(GOLDEN.map((g) => g.company))];

/** Minimum pass rate for the eval to succeed (overridable via EVAL_THRESHOLD). */
export const DEFAULT_THRESHOLD = 0.9;

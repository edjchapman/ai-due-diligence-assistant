import type { Extraction } from './extract';

/**
 * The extraction golden set (M6) — the ground-truth DD fields planted in each
 * company's PDF filing summary (`fixtures/<slug>/filing-summary.pdf`). The
 * extraction test scores `extract(decodePdf(pdf))` against these with field-level
 * precision/recall/F1, echoing the real-world pipeline's Recall/F1 framing.
 *
 * Only the *facts* are scored (see `factsOf` in the test): non-null scalars, true
 * booleans, and related-party counterparties. Nulls / false / empty arrays are
 * "negatives" — the extractor is penalised (as a false positive) if it invents one.
 */
export interface GoldenExtraction {
  slug: string;
  company: string;
  expected: Pick<
    Extraction,
    'revenueConcentration' | 'relatedParties' | 'goingConcern' | 'auditor'
  >;
}

const NO_EVIDENCE = { evidence: null };

export const GOLDEN_EXTRACTIONS: GoldenExtraction[] = [
  {
    slug: 'northwind-materials',
    company: 'Northwind Materials Inc.',
    expected: {
      revenueConcentration: {
        largestCustomerPct: 62,
        largestCustomer: 'Pallas Automotive Group',
        ...NO_EVIDENCE,
      },
      relatedParties: [],
      goingConcern: { substantialDoubt: false, ...NO_EVIDENCE },
      auditor: { changed: true, auditorName: 'Crestline Audit LLP', ...NO_EVIDENCE },
    },
  },
  {
    slug: 'helios-robotics',
    company: 'Helios Robotics Corp.',
    expected: {
      revenueConcentration: { largestCustomerPct: null, largestCustomer: null, ...NO_EVIDENCE },
      relatedParties: [
        {
          counterparty: 'Vega Holdings LLC',
          relationship: 'entity controlled by the Chief Executive Officer',
          ...NO_EVIDENCE,
        },
      ],
      goingConcern: { substantialDoubt: true, ...NO_EVIDENCE },
      auditor: { changed: false, auditorName: null, ...NO_EVIDENCE },
    },
  },
  {
    slug: 'meridian-foods',
    company: 'Meridian Foods PLC',
    expected: {
      revenueConcentration: { largestCustomerPct: null, largestCustomer: null, ...NO_EVIDENCE },
      relatedParties: [],
      goingConcern: { substantialDoubt: false, ...NO_EVIDENCE },
      auditor: { changed: false, auditorName: 'Kingsbridge LLP', ...NO_EVIDENCE },
    },
  },
];

/** Minimum extraction F1 for the test to pass (mirrors the eval's threshold idea). */
export const EXTRACTION_F1_THRESHOLD = 0.9;

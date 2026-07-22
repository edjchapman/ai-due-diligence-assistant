import { describe, expect, it } from 'vitest';
import { CHECKS, type Check } from '../src/checks';
import type { CitedChunk } from '../src/db/search';
import { reason } from '../src/reasoner';
import { useLocalProviders } from './helpers';

const byId = (id: string): Check => {
  const check = CHECKS.find((c) => c.id === id);
  if (!check) throw new Error(`unknown check: ${id}`);
  return check;
};

const chunk = (content: string): CitedChunk => ({
  content,
  ordinal: 0,
  company: 'Acme',
  sourceType: '10-K',
  title: 'excerpt',
  score: 1,
});

const verdictOf = (id: string, text: string) => reason(byId(id), 'Acme', [chunk(text)]);

// Keyless: the local heuristic encodes the signals the golden set (M4) expects.
describe('local reasoner (LLM_PROVIDER=local)', () => {
  useLocalProviders('LLM_PROVIDER');

  it('flags going concern but reads its negation as clear', async () => {
    expect(
      (
        await verdictOf(
          'going-concern',
          'substantial doubt about its ability to continue as a going concern',
        )
      ).verdict,
    ).toBe('flagged');
    expect(
      (await verdictOf('going-concern', 'substantial doubt about going concern does not exist'))
        .verdict,
    ).toBe('clear');
  });

  it('flags a high single-customer revenue share, clears a diversified base', async () => {
    expect(
      (
        await verdictOf(
          'revenue-concentration',
          'sales to our single largest customer represented 62% of net revenue',
        )
      ).verdict,
    ).toBe('flagged');
    expect(
      (
        await verdictOf(
          'revenue-concentration',
          'No single customer accounted for more than 8% of revenue',
        )
      ).verdict,
    ).toBe('clear');
  });

  it('flags an insider-controlled related party, clears when none disclosed', async () => {
    expect(
      (
        await verdictOf(
          'related-party',
          "Related-party transactions: the Company leases from an entity controlled by the CEO, not negotiated at arm's length.",
        )
      ).verdict,
    ).toBe('flagged');
    expect(
      (
        await verdictOf(
          'related-party',
          'there were no material related-party transactions during the year',
        )
      ).verdict,
    ).toBe('clear');
  });

  it('flags an auditor change, clears a reappointment', async () => {
    expect(
      (
        await verdictOf(
          'auditor-change',
          'the Audit Committee dismissed Barrow & Finch and engaged Crestline as accounting firm',
        )
      ).verdict,
    ).toBe('flagged');
    expect(
      (
        await verdictOf(
          'auditor-change',
          'the auditor was reappointed, having served as auditor since 2019',
        )
      ).verdict,
    ).toBe('clear');
  });

  it('is uncertain when nothing was retrieved', async () => {
    expect((await reason(byId('going-concern'), 'Acme', [])).verdict).toBe('uncertain');
  });
});

import { describe, expect, it } from 'vitest';
import type { Finding, Verdict } from '../src/checks';
import type { GoldenItem } from '../src/golden';
import { judge } from '../src/judge';
import { useLocalProviders } from './helpers';

const golden: GoldenItem = { company: 'Acme', checkId: 'going-concern', expected: 'flagged' };

const finding = (verdict: Verdict): Finding => ({
  checkId: 'going-concern',
  label: 'Going concern',
  verdict,
  summary: 'Excerpts state substantial doubt about going concern.',
  citations: [],
});

// The deterministic judge is what scores `make eval` in CI — pin its contract.
describe('local judge (JUDGE_PROVIDER=local)', () => {
  useLocalProviders('JUDGE_PROVIDER');

  it('passes when the verdict matches the golden expectation', async () => {
    const result = await judge(golden, finding('flagged'));
    expect(result.pass).toBe(true);
    expect(result.reason).toContain('flagged');
  });

  it('fails a mismatch, naming both verdicts in the reason', async () => {
    const result = await judge(golden, finding('clear'));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('expected flagged');
    expect(result.reason).toContain('got clear');
  });

  it('fails when the agent produced no finding for the check', async () => {
    const result = await judge(golden, undefined);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('no finding');
  });
});

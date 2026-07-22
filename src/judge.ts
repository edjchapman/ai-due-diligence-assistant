import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { Finding } from './checks';
import { getConfig } from './config';
import type { GoldenItem } from './golden';

/**
 * Scores one agent finding against its golden expectation.
 *
 * Two providers, selected by `JUDGE_PROVIDER`:
 *   - `anthropic`: an LLM-as-judge (Claude) — passes only if the verdict matches
 *     AND the summary is faithful to the cited evidence. Needs `ANTHROPIC_API_KEY`.
 *   - default (`local`): a deterministic judge — exact verdict match. Keyless, so
 *     `make eval` and CI score without a key; the CI number is a regression gate.
 */
export interface Judgement {
  pass: boolean;
  reason: string;
}

const MODEL = 'claude-sonnet-4-6';

const judgeSchema = z.object({
  pass: z.boolean(),
  reason: z.string().describe('One sentence explaining the grade.'),
});

export async function judge(
  expected: GoldenItem,
  finding: Finding | undefined,
): Promise<Judgement> {
  if (!finding) return { pass: false, reason: 'agent produced no finding for this check' };
  return getConfig().JUDGE_PROVIDER === 'anthropic'
    ? anthropicJudge(expected, finding)
    : localJudge(expected, finding);
}

function localJudge(expected: GoldenItem, finding: Finding): Judgement {
  const pass = finding.verdict === expected.expected;
  return {
    pass,
    reason: pass
      ? `verdict matches (${finding.verdict})`
      : `expected ${expected.expected}, got ${finding.verdict}`,
  };
}

async function anthropicJudge(expected: GoldenItem, finding: Finding): Promise<Judgement> {
  // TODO(ai-sdk): generateObject is deprecated in favour of generateText +
  // Output.object; migrating needs a keyed run to verify the anthropic path.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: judgeSchema,
    system:
      'You grade a due-diligence finding against an expected verdict. Pass only if BOTH: ' +
      '(a) the agent verdict equals the expected verdict, and (b) the summary is faithful to ' +
      'the cited evidence and not fabricated. Otherwise fail.',
    prompt:
      `Check: ${finding.label}\nExpected verdict: ${expected.expected}\n` +
      `Agent verdict: ${finding.verdict}\nAgent summary: ${finding.summary}\n` +
      `Cited evidence: ${finding.citations.map((c) => c.snippet).join(' | ') || '(none)'}`,
  });
  return object;
}

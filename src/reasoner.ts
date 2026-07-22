import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { Check, Verdict } from './checks';
import { getConfig } from './config';
import type { CitedChunk } from './db/search';

/**
 * Reasons a verdict for one due-diligence check from retrieved evidence.
 *
 * Two providers, selected by `LLM_PROVIDER` (mirrors the embedder):
 *   - `anthropic` (default): Claude via the Vercel AI SDK; needs `ANTHROPIC_API_KEY`.
 *   - `local`: a deterministic keyword/negation heuristic — keyless, reproducible,
 *     and used by `make demo`, tests, and CI. It is a *stand-in* for the model, not
 *     a claim to reason; it encodes the same signals the golden set (M4) expects.
 *
 * Sonnet 4.6 is the default model — the report and the M4 LLM-as-judge run
 * repeatedly in CI, so it's the sensible cost/quality point; swap to Opus 4.8 for
 * the hardest checks by changing MODEL.
 */
const MODEL = 'claude-sonnet-4-6';

export interface Reasoned {
  verdict: Verdict;
  summary: string;
}

const useLocalProvider = (): boolean => getConfig().LLM_PROVIDER === 'local';

const verdictSchema = z.object({
  verdict: z.enum(['flagged', 'clear', 'uncertain']),
  summary: z.string().describe('One sentence, citing the specific evidence.'),
});

export async function reason(
  check: Check,
  company: string,
  chunks: CitedChunk[],
): Promise<Reasoned> {
  if (chunks.length === 0) {
    return { verdict: 'uncertain', summary: 'No relevant passages were retrieved.' };
  }
  return useLocalProvider() ? localReason(check, chunks) : anthropicReason(check, company, chunks);
}

async function anthropicReason(
  check: Check,
  company: string,
  chunks: CitedChunk[],
): Promise<Reasoned> {
  const evidence = chunks.map((c, i) => `[${i + 1}] (${c.sourceType}) ${c.content}`).join('\n\n');
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: verdictSchema,
    system:
      'You are a due-diligence analyst. Answer ONLY from the provided excerpts. ' +
      'Do not speculate beyond them. Return "clear" when the excerpts show the concern ' +
      'does not apply, "flagged" when it does, and "uncertain" when the excerpts are inconclusive.',
    prompt:
      `Company: ${company}\nCheck: ${check.label}\nQuestion: ${check.question}\n\n` +
      `Excerpts:\n${evidence}`,
  });
  return object;
}

/**
 * Deterministic heuristic reasoner. Reads the retrieved text for the signals each
 * check turns on, handling the one case pure lexical retrieval can't: negation
 * (e.g. "substantial doubt ... does not exist" is `clear`, not `flagged`).
 */
function localReason(check: Check, chunks: CitedChunk[]): Reasoned {
  const text = chunks
    .map((c) => c.content)
    .join('\n')
    .toLowerCase();
  const has = (re: RegExp): boolean => re.test(text);

  switch (check.id) {
    case 'going-concern': {
      const doubt = has(/substantial doubt/);
      const negated = has(/does not exist|no substantial doubt|not exist/);
      if (doubt && !negated) {
        return {
          verdict: 'flagged',
          summary: 'Excerpts state substantial doubt about going concern.',
        };
      }
      return {
        verdict: 'clear',
        summary: 'No going-concern doubt; excerpts affirm the going-concern basis.',
      };
    }
    case 'revenue-concentration': {
      if (
        has(/no single customer|no customer accounted for more than|not .*dependent on any single/)
      ) {
        return {
          verdict: 'clear',
          summary: 'Diversified customer base; no single-customer dependence.',
        };
      }
      const pct = text.match(/(\d{2,3})\s?%/);
      const concentrated = has(/largest customer|customer concentration|concentration of revenue/);
      if (concentrated && pct && Number(pct[1]) >= 20) {
        return {
          verdict: 'flagged',
          summary: `Revenue concentrated in one customer (~${pct[1]}% of revenue).`,
        };
      }
      return { verdict: 'uncertain', summary: 'Customer-concentration evidence is inconclusive.' };
    }
    case 'related-party': {
      if (has(/no (material )?related.?part/)) {
        return { verdict: 'clear', summary: 'No material related-party transactions disclosed.' };
      }
      if (has(/related.?part/) && has(/controlled by|arm.?s length|entity controlled/)) {
        return {
          verdict: 'flagged',
          summary: 'Related-party dealings with an entity controlled by an insider.',
        };
      }
      return { verdict: 'clear', summary: 'No related-party concern found in retrieved excerpts.' };
    }
    case 'auditor-change': {
      if (has(/no change[s]? of auditor|reappointed|served as .*auditor since/)) {
        return { verdict: 'clear', summary: 'No auditor change; incumbent auditor reappointed.' };
      }
      if (has(/dismissed|replaced its .*auditor|engaged .*accounting firm|change.* accountants/)) {
        return { verdict: 'flagged', summary: 'The company changed its independent auditor.' };
      }
      return { verdict: 'clear', summary: 'No auditor change found in retrieved excerpts.' };
    }
    default:
      return { verdict: 'uncertain', summary: 'No heuristic for this check.' };
  }
}

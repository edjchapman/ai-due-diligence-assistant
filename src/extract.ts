import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getConfig } from './config';

/**
 * Structured extraction (M6) — the front half of the system: turn a filing's
 * unstructured text into typed, DD-relevant fields, each with the evidence
 * snippet it was read from. The four field groups map 1:1 onto the four checks
 * (src/checks.ts), so the extraction is directly comparable to the agent's
 * findings and to the extraction golden set (src/golden-extract.ts).
 *
 * Two providers, selected by `EXTRACT_PROVIDER`. Note the default is **local**,
 * not anthropic (unlike the reasoner): extraction runs inside the *ingest* path,
 * which the keyless demo/eval/CI all exercise — so a forgotten env var must fall
 * back to keyless, never reach for a key. Mirrors `judge.ts`'s inversion.
 *   - `local` (default): a deterministic keyword/regex reader — keyless,
 *     reproducible, and a stand-in encoding the same signals the golden set
 *     expects (it reuses the reasoner's negation-aware regexes).
 *   - `anthropic`: Claude via the Vercel AI SDK's `generateObject` + this Zod
 *     schema (the idiomatic structured-output pattern already in reasoner.ts /
 *     judge.ts). Needs `ANTHROPIC_API_KEY`.
 */
const MODEL = 'claude-sonnet-4-6';

const extractionSchema = z.object({
  revenueConcentration: z.object({
    largestCustomerPct: z
      .number()
      .nullable()
      .describe(
        'Percent of revenue from the single largest customer, or null if not concentrated.',
      ),
    largestCustomer: z.string().nullable().describe('Name of the largest customer, or null.'),
    evidence: z.string().nullable().describe('The sentence this was read from, or null.'),
  }),
  relatedParties: z
    .array(
      z.object({
        counterparty: z.string().describe('The related entity, e.g. "Vega Holdings LLC".'),
        relationship: z.string().describe('How it relates, e.g. "entity controlled by the CEO".'),
        evidence: z.string().nullable(),
      }),
    )
    .describe('Material related-party transactions; empty when none are disclosed.'),
  goingConcern: z.object({
    substantialDoubt: z
      .boolean()
      .describe('True only if the text states substantial doubt that is NOT negated.'),
    evidence: z.string().nullable(),
  }),
  auditor: z.object({
    changed: z.boolean().describe('True if the company changed its independent auditor.'),
    auditorName: z
      .string()
      .nullable()
      .describe('The newly-engaged auditor if changed, else the named incumbent, else null.'),
    evidence: z.string().nullable(),
  }),
});

export type Extraction = z.infer<typeof extractionSchema>;

const useLocalProvider = (): boolean => getConfig().EXTRACT_PROVIDER === 'local';

/** Extract typed DD fields from a document's decoded text. */
export async function extract(text: string): Promise<Extraction> {
  return useLocalProvider() ? localExtract(text) : anthropicExtract(text);
}

async function anthropicExtract(text: string): Promise<Extraction> {
  // TODO(ai-sdk): generateObject is deprecated in favour of generateText +
  // Output.object; migrating needs a keyed run to verify the anthropic path.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: extractionSchema,
    system:
      'You extract due-diligence facts from a company filing. Report ONLY fields present in ' +
      'the text; use null (or an empty array) when a fact is absent — never guess. For going ' +
      'concern, report substantialDoubt=true only when the text asserts doubt and does not negate ' +
      'it. Quote the source sentence in each `evidence` field.',
    prompt: text,
  });
  return object;
}

/**
 * Deterministic reader. Operates on the raw (space-joined) PDF text, reusing the
 * reasoner's signal regexes — including negation, which lexical matching alone
 * can't see (e.g. "substantial doubt ... does not exist" → substantialDoubt
 * false; "no single customer ..." → not concentrated). Keyless and byte-stable.
 */
function localExtract(text: string): Extraction {
  const has = (re: RegExp): boolean => re.test(text);
  const first = (re: RegExp): string | null => text.match(re)?.[1]?.trim() ?? null;
  const sentence = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[0].trim().replace(/\s+/g, ' ') : null;
  };

  // Revenue concentration — negation guard first (a diversified base is not a flag).
  const diversified = has(
    /no single customer|no customer accounted for more than|not\s+\w+\s+dependent on any single|do not consider .{0,40}dependent on any single/i,
  );
  const pctText = text.match(/(\d{2,3})\s?%/);
  const revenueConcentration = diversified
    ? { largestCustomerPct: null, largestCustomer: null, evidence: null }
    : {
        largestCustomerPct: pctText ? Number(pctText[1]) : null,
        largestCustomer: first(/largest customer,\s*([A-Z][\w .&'-]+?),\s*represented/i),
        evidence: sentence(/[^.]*largest customer[^.]*\d{2,3}\s?%[^.]*\./i),
      };

  // Related parties — "no related-party" clears; otherwise capture an insider-controlled entity.
  const relatedParties =
    has(/no (material )?related.?part/i) || !has(/related.?part/i)
      ? []
      : (() => {
          const counterparty = first(/from ([A-Z][\w .&'-]+? LLC)/i);
          const relationship = first(/(entity controlled by [^.,;]+)/i);
          return counterparty && relationship
            ? [
                {
                  counterparty,
                  relationship: relationship.replace(/\s+/g, ' '),
                  evidence:
                    sentence(/[^.]*related.?part[^.]*\./i) ??
                    sentence(/[^.]*controlled by[^.]*\./i),
                },
              ]
            : [];
        })();

  // Going concern — doubt present AND not negated.
  const doubt = has(/substantial doubt/i);
  const negated = has(/does not exist|no substantial doubt|not exist/i);
  const goingConcern = {
    substantialDoubt: doubt && !negated,
    evidence: doubt ? sentence(/[^.]*substantial doubt[^.]*\./i) : null,
  };

  // Auditor — a change (dismiss + engage) vs. a reappointment; name the relevant firm.
  const changeSignal = has(/engaged [^.]*accounting firm|dismissed [A-Z][\w .&]+? LLP/i);
  const noChangeSignal = has(
    /no change[s]? of auditor|reappointed|served (as .{0,20}auditor )?since/i,
  );
  const changed = changeSignal && !noChangeSignal;
  const auditor = {
    changed,
    auditorName: changed
      ? first(/engaged ([A-Z][\w .&'-]+? LLP)/i)
      : first(/auditor,\s+([A-Z][\w .&'-]+? LLP)/i),
    evidence: sentence(/[^.]*auditor[^.]*\./i),
  };

  return { revenueConcentration, relatedParties, goingConcern, auditor };
}

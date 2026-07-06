import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { EMBEDDING_DIMENSIONS } from './db/schema';

/**
 * Embeddings behind the Vercel AI SDK. OpenAI does the *vectors*; Anthropic is
 * reserved for *reasoning* (M3) — one SDK, two providers (see ADR 0001). The
 * dimensionality (1536) is pinned by the pgvector column (`EMBEDDING_DIMENSIONS`).
 *
 * Two providers, selected by `EMBED_PROVIDER`:
 *   - `openai` (default): `text-embedding-3-small`; needs `OPENAI_API_KEY`.
 *   - `local`: a deterministic, keyless bag-of-words embedder for demos, tests,
 *     and CI — no network, no secret, byte-for-byte reproducible.
 *
 * The OpenAI provider is lazy, so importing this module needs no key — the DB
 * layer and the local path stay usable without one.
 */
const MODEL = 'text-embedding-3-small';

const useLocalProvider = (): boolean => process.env.EMBED_PROVIDER === 'local';

// Common English words carry no signal and, unfiltered, dominate a bag-of-words
// vector — so distinctive terms ("concentration", "auditor") get drowned out.
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'by',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'has',
  'have',
  'had',
  'its',
  'it',
  'this',
  'that',
  'these',
  'those',
  'we',
  'our',
  'their',
  'which',
  'not',
  'no',
  'any',
  'all',
  'more',
  'than',
  'about',
  'company',
]);

/**
 * Hash each meaningful token into a bucket of the vector and L2-normalize.
 * Lexical overlap between a query and a chunk then shows up as cosine similarity
 * — enough to surface the right cited passage for distinctive due-diligence
 * terms, with zero dependencies. Not a semantic model (it can't see negation or
 * synonyms — that's what the OpenAI provider is for); a reproducible stand-in.
 */
function localEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const token of tokens) {
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    let hash = 5381; // djb2
    for (let i = 0; i < token.length; i += 1) {
      hash = ((hash << 5) + hash + token.charCodeAt(i)) >>> 0;
    }
    const bucket = hash % EMBEDDING_DIMENSIONS;
    vec[bucket] = (vec[bucket] ?? 0) + 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

/** Embed a batch of chunk texts. Order of the returned vectors matches the input. */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  if (useLocalProvider()) return values.map(localEmbed);
  const { embeddings } = await embedMany({ model: openai.embedding(MODEL), values });
  return embeddings;
}

/** Embed a single search query. */
export async function embedQuery(value: string): Promise<number[]> {
  if (useLocalProvider()) return localEmbed(value);
  const { embedding } = await embed({ model: openai.embedding(MODEL), value });
  return embedding;
}

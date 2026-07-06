import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';

/**
 * Embedding model, behind the Vercel AI SDK. OpenAI does the *vectors*; Anthropic
 * is reserved for *reasoning* (M3) — one SDK, two providers (see ADR 0001). The
 * dimensionality (1536) is pinned by the pgvector column; see `EMBEDDING_DIMENSIONS`.
 * Requires `OPENAI_API_KEY` at call time (the provider is lazy, so importing this
 * module needs no key — the DB layer stays testable without one).
 */
const embeddingModel = openai.embedding('text-embedding-3-small');

/** Embed a batch of chunk texts. Order of the returned vectors matches the input. */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({ model: embeddingModel, values });
  return embeddings;
}

/** Embed a single search query. */
export async function embedQuery(value: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value });
  return embedding;
}

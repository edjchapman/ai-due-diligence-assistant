import { beforeAll, describe } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { chunks, documents } from '../src/db/schema';

/**
 * Shared test plumbing. Everything here preserves the call-site semantics the
 * suites already rely on — in particular, provider env vars are set inside a
 * registered `beforeAll` (not vitest `setupFiles`), because src/config.ts
 * reads env lazily and the suites depend on set-after-import working.
 */

/** Run a suite only when RUN_DB_TESTS is set — CI provides the pgvector service. */
export const dbDescribe = process.env.RUN_DB_TESTS ? describe : describe.skip;

type ProviderVar =
  'EMBED_PROVIDER' | 'LLM_PROVIDER' | 'EXTRACT_PROVIDER' | 'JUDGE_PROVIDER' | 'PDF_PROVIDER';

/**
 * Register a `beforeAll` switching the given providers to their keyless local
 * implementations. Call before any hook that uses them (hooks run in
 * registration order), e.g. a seeding `beforeAll` that embeds.
 */
export function useLocalProviders(...vars: ProviderVar[]): void {
  beforeAll(() => {
    for (const name of vars) process.env[name] = 'local';
  });
}

export interface SeedChunk {
  content: string;
  embedding: number[];
}

/**
 * Seed one document (+ chunks) for a sentinel company, deleting any rows a
 * previously crashed run left behind. Pair with `cleanupCompany` in `afterAll`.
 */
export async function seedCompanyCorpus(
  company: string,
  seedChunks: SeedChunk[],
  meta: { sourceType: string; title: string } = { sourceType: '10-K', title: 'fixture' },
): Promise<void> {
  await cleanupCompany(company);
  const inserted = await db
    .insert(documents)
    .values({ company, ...meta })
    .returning({ id: documents.id });
  const documentId = inserted[0]?.id;
  if (!documentId) throw new Error('failed to insert test document');
  await db.insert(chunks).values(seedChunks.map((c, i) => ({ documentId, ordinal: i, ...c })));
}

/** Delete every row for the sentinel company (chunks cascade via the FK). */
export async function cleanupCompany(company: string): Promise<void> {
  await db.delete(documents).where(eq(documents.company, company));
}

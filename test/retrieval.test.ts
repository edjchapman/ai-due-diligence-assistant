import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, sql } from '../src/db/client';
import { searchByVector } from '../src/db/search';
import { chunks, documents, EMBEDDING_DIMENSIONS } from '../src/db/schema';

/**
 * Vector round-trip against real Postgres/pgvector. Gated on RUN_DB_TESTS so the
 * default `npm test` (and the pre-commit `make check`) stays DB-free; CI sets the
 * flag and provides the pgvector service. Deliberately uses deterministic basis
 * vectors — no embedding provider, so CI needs no API key (guardrail #3).
 */
const dbTests = process.env.RUN_DB_TESTS ? describe : describe.skip;

/** A unit basis vector e_i: cosine-similarity 1 with itself, 0 with any other e_j. */
function basisVector(i: number): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  v[i] = 1;
  return v;
}

const TEST_COMPANY = '__retrieval_test__';

dbTests('searchByVector (pgvector)', () => {
  beforeAll(async () => {
    await db.delete(documents).where(eq(documents.company, TEST_COMPANY));
    const inserted = await db
      .insert(documents)
      .values({ company: TEST_COMPANY, sourceType: 'test', title: 'fixture' })
      .returning({ id: documents.id });
    const documentId = inserted[0]?.id;
    if (!documentId) throw new Error('failed to insert test document');

    await db.insert(chunks).values([
      { documentId, ordinal: 0, content: 'alpha', embedding: basisVector(0) },
      { documentId, ordinal: 1, content: 'beta', embedding: basisVector(1) },
      { documentId, ordinal: 2, content: 'gamma', embedding: basisVector(2) },
    ]);
  });

  afterAll(async () => {
    await db.delete(documents).where(eq(documents.company, TEST_COMPANY));
    await sql.end();
  });

  it('ranks the nearest chunk first with similarity ~1', async () => {
    const results = await searchByVector(basisVector(1), 3);
    const top = results[0];
    expect(top?.content).toBe('beta');
    expect(top?.score).toBeCloseTo(1, 5);
    expect(top?.company).toBe(TEST_COMPANY);
  });

  it('respects the k limit', async () => {
    const results = await searchByVector(basisVector(0), 2);
    expect(results).toHaveLength(2);
    expect(results[0]?.content).toBe('alpha');
  });
});

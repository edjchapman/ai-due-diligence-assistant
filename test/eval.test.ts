import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db, sql } from '../src/db/client';
import { documents } from '../src/db/schema';
import { runEval } from '../src/eval';
import { GOLDEN, GOLDEN_COMPANIES } from '../src/golden';
import { ingestAll } from '../src/ingest';

/**
 * The eval harness as a CI regression gate: ingest the corpus, run the agent over
 * every reference company, and score against the golden set. Keyless/deterministic
 * (local providers), gated on RUN_DB_TESTS; CI provides pgvector. A drop in the
 * score — from broken retrieval, scoping, the graph, or the golden set — fails CI.
 */
const dbTests = process.env.RUN_DB_TESTS ? describe : describe.skip;

dbTests('eval harness (golden set)', () => {
  beforeAll(async () => {
    process.env.EMBED_PROVIDER = 'local';
    process.env.LLM_PROVIDER = 'local';
    process.env.JUDGE_PROVIDER = 'local';
    await ingestAll();
  });

  afterAll(async () => {
    await db.delete(documents).where(inArray(documents.company, GOLDEN_COMPANIES));
    await sql.end();
  });

  it('scores the agent 100% against the golden set (deterministic)', async () => {
    const report = await runEval();
    expect(report.total).toBe(GOLDEN.length);
    expect(report.score).toBe(1);
    expect(report.passed).toBe(true);
  });
});

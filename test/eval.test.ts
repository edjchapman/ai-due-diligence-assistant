import { afterAll, beforeAll, expect, it } from 'vitest';
import { sql } from '../src/db/client';
import { runEval } from '../src/eval';
import { GOLDEN, GOLDEN_COMPANIES } from '../src/golden';
import { ingestAll } from '../src/ingest';
import { cleanupCompany, dbDescribe, useLocalProviders } from './helpers';

/**
 * The eval harness as a CI regression gate: ingest the corpus, run the agent over
 * every reference company, and score against the golden set. Keyless/deterministic
 * (local providers), gated on RUN_DB_TESTS; CI provides pgvector. A drop in the
 * score — from broken retrieval, scoping, the graph, or the golden set — fails CI.
 */
dbDescribe('eval harness (golden set)', () => {
  useLocalProviders('EMBED_PROVIDER', 'LLM_PROVIDER', 'JUDGE_PROVIDER');

  beforeAll(async () => {
    await ingestAll();
  });

  afterAll(async () => {
    for (const company of GOLDEN_COMPANIES) await cleanupCompany(company);
    await sql.end();
  });

  it('scores the agent 100% against the golden set (deterministic)', async () => {
    const report = await runEval();
    expect(report.total).toBe(GOLDEN.length);
    expect(report.score).toBe(1);
    expect(report.passed).toBe(true);
  });
});

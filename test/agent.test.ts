import { afterAll, beforeAll, expect, it } from 'vitest';
import { runReport } from '../src/agent';
import { CHECKS } from '../src/checks';
import { sql } from '../src/db/client';
import { embedTexts } from '../src/embeddings';
import { cleanupCompany, dbDescribe, seedCompanyCorpus, useLocalProviders } from './helpers';

/**
 * End-to-end agent run against real pgvector: embed → store → retrieve → reason →
 * graph → report. Keyless (local providers), gated on RUN_DB_TESTS like the other
 * DB test; CI provides the pgvector service.
 */
const COMPANY = '__agent_test__';

dbDescribe('runReport (agent over pgvector)', () => {
  useLocalProviders('EMBED_PROVIDER', 'LLM_PROVIDER');

  beforeAll(async () => {
    const texts = [
      'The Company has substantial doubt about its ability to continue as a going concern.',
      'No single customer accounted for more than 8% of revenue; the base is diversified.',
    ];
    const embeddings = await embedTexts(texts);
    await seedCompanyCorpus(
      COMPANY,
      texts.map((content, i) => {
        const embedding = embeddings[i];
        if (!embedding) throw new Error('embedding/chunk length mismatch');
        return { content, embedding };
      }),
    );
  });

  afterAll(async () => {
    await cleanupCompany(COMPANY);
    await sql.end();
  });

  it('returns a cited finding per check with the expected verdicts', async () => {
    const report = await runReport(COMPANY);
    expect(report.findings).toHaveLength(CHECKS.length);

    const byId = new Map(report.findings.map((f) => [f.checkId, f]));
    expect(byId.get('going-concern')?.verdict).toBe('flagged');
    expect(byId.get('revenue-concentration')?.verdict).toBe('clear');
    // A flagged finding must carry its evidence.
    expect(byId.get('going-concern')?.citations.length).toBeGreaterThan(0);
    expect(byId.get('going-concern')?.citations[0]?.company).toBe(COMPANY);
  });
});

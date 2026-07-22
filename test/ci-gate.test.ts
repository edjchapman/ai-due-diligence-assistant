import { describe, expect, it } from 'vitest';

/**
 * Guard against the DB suites silently vanishing from CI. The agent,
 * retrieval, and eval suites skip themselves when RUN_DB_TESTS is unset — so
 * if the env var were ever lost from ci.yml, CI would go green *without* the
 * only end-to-end coverage of the agent, pgvector retrieval, and the eval
 * gate. GitHub Actions always sets CI=true; locally this test is a no-op.
 */
describe('CI gate', () => {
  it('has RUN_DB_TESTS set whenever running in CI', () => {
    if (process.env.CI) {
      expect(process.env.RUN_DB_TESTS, 'DB suites would silently skip in CI').toBeTruthy();
    }
  });
});

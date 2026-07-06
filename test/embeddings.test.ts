import { beforeAll, describe, expect, it } from 'vitest';
import { embedQuery, embedTexts } from '../src/embeddings';
import { EMBEDDING_DIMENSIONS } from '../src/db/schema';

/** Dot product; both operands are unit-norm, so this is cosine similarity. */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

// The keyless local embedder backs `make demo`, tests, and CI, so it's worth
// pinning. No network, no API key.
describe('local embedder (EMBED_PROVIDER=local)', () => {
  beforeAll(() => {
    process.env.EMBED_PROVIDER = 'local';
  });

  it('produces a unit-norm vector of the pinned dimensionality', async () => {
    const v = await embedQuery('going concern doubt');
    expect(v).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.sqrt(dot(v, v))).toBeCloseTo(1, 6);
  });

  it('ranks a lexically matching passage above an unrelated one', async () => {
    const query = await embedQuery('related-party lease with the CEO');
    const [match, other] = await embedTexts([
      'The Company leases its headquarters from an entity controlled by the CEO — a related-party lease.',
      'Revenue grew across a diversified base of grocery retailers and wholesalers.',
    ]);
    expect(match).toBeDefined();
    expect(other).toBeDefined();
    expect(dot(query, match ?? [])).toBeGreaterThan(dot(query, other ?? []));
  });
});

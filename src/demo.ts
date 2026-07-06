import { sql } from './db/client';
import { searchByVector } from './db/search';
import { embedQuery } from './embeddings';

/**
 * Milestone demo (M2): fire a handful of due-diligence queries through the real
 * ingest → embed → cosine-retrieval path and print the top cited passage for
 * each. Run via `make demo` (keyless: EMBED_PROVIDER=local). Each milestone
 * extends this script to showcase what it added.
 */
const QUERIES = [
  'customer concentration risk from dependence on Pallas Automotive',
  'going concern doubt and the Series D cash runway',
  'related-party lease and bridge loan from Vega Holdings',
  'auditor dismissed — Barrow & Finch replaced by Crestline',
];

function snippet(text: string, max = 100): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

async function main(): Promise<void> {
  const provider =
    process.env.EMBED_PROVIDER === 'local'
      ? 'local (deterministic, keyless)'
      : 'openai · text-embedding-3-small';
  console.log(`\n  AI Due Diligence — retrieval demo   [embeddings: ${provider}]`);
  if (process.env.EMBED_PROVIDER === 'local') {
    console.log(
      '  (lexical stand-in — set OPENAI_API_KEY and EMBED_PROVIDER=openai for semantic retrieval)',
    );
  }
  console.log('');

  for (const query of QUERIES) {
    const results = await searchByVector(await embedQuery(query), 1);
    const top = results[0];
    console.log(`  ▸ ${query}`);
    if (!top) {
      console.log('      (no results — run `make demo`, or `npm run ingest` first)\n');
      continue;
    }
    console.log(
      `      ${top.company}  ·  ${top.sourceType} #${top.ordinal}  ·  score ${top.score.toFixed(3)}`,
    );
    console.log(`      “${snippet(top.content)}”\n`);
  }
}

try {
  await main();
} finally {
  await sql.end();
}

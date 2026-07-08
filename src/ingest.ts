import { readFile } from 'node:fs/promises';
import { argv } from 'node:process';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { chunkText } from './chunk';
import { db, sql } from './db/client';
import { chunks, documents } from './db/schema';
import { embedTexts } from './embeddings';
import { extract } from './extract';
import { decodePdf } from './pdf';

/**
 * Ingest CLI (M2). Loads the reference-company fixtures, chunks each document,
 * embeds the chunks (OpenAI via the Vercel AI SDK), and writes `documents` +
 * `chunks` (with vectors) to Postgres/pgvector.
 *
 *   npm run ingest              # all reference companies
 *   npm run ingest -- helios    # only companies matching "helios" (slug or name)
 *
 * Re-running is idempotent per company: existing rows for that company are
 * deleted (cascade) before re-insert, so the demo can be run repeatedly.
 */

interface DocumentSpec {
  sourceType: string;
  title: string;
  file: string;
}

interface CompanySpec {
  company: string;
  slug: string;
  documents: DocumentSpec[];
}

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/**
 * Load a fixture document's text, dispatching on file extension. Markdown/text
 * files are read verbatim (the M2 path, unchanged); PDFs (M6) are decoded via
 * `decodePdf` so a real filing flows through the *same* chunk → embed → store
 * pipeline. The decoded text is what feeds both retrieval and extraction.
 */
async function readDocumentText(slug: string, file: string): Promise<string> {
  const path = join(FIXTURES_DIR, slug, file);
  switch (extname(file).toLowerCase()) {
    case '.md':
    case '.txt':
      return readFile(path, 'utf8');
    case '.pdf':
      return decodePdf(new Uint8Array(await readFile(path)));
    default:
      throw new Error(`unsupported fixture format: ${file}`);
  }
}

async function loadManifest(): Promise<CompanySpec[]> {
  const raw = await readFile(join(FIXTURES_DIR, 'manifest.json'), 'utf8');
  return JSON.parse(raw) as CompanySpec[];
}

function matches(spec: CompanySpec, filters: string[]): boolean {
  if (filters.length === 0) return true;
  const haystack = `${spec.slug} ${spec.company}`.toLowerCase();
  return filters.some((f) => haystack.includes(f.toLowerCase()));
}

async function ingestCompany(spec: CompanySpec): Promise<number> {
  // Idempotent re-run: drop this company's documents (chunks cascade) first.
  await db.delete(documents).where(eq(documents.company, spec.company));

  let chunkCount = 0;
  for (const doc of spec.documents) {
    const text = await readDocumentText(spec.slug, doc.file);
    const texts = chunkText(text);
    if (texts.length === 0) continue;

    const embeddings = await embedTexts(texts);
    if (embeddings.length !== texts.length) {
      throw new Error(`embedding count (${embeddings.length}) != chunk count (${texts.length})`);
    }

    // Structured DD extraction (M6) over the same decoded text — stored on the
    // document so it can be surfaced (`/extract`, demo) alongside the report.
    const extraction = await extract(text);

    const inserted = await db
      .insert(documents)
      .values({ company: spec.company, sourceType: doc.sourceType, title: doc.title, extraction })
      .returning({ id: documents.id });
    const documentRow = inserted[0];
    if (!documentRow) throw new Error(`failed to insert document: ${doc.title}`);

    const values = embeddings.map((embedding, i) => {
      const content = texts[i];
      if (content === undefined) throw new Error('chunk/embedding length mismatch');
      return { documentId: documentRow.id, ordinal: i, content, embedding };
    });
    await db.insert(chunks).values(values);
    chunkCount += values.length;
  }
  return chunkCount;
}

export interface IngestResult {
  company: string;
  chunks: number;
}

/**
 * Ingest the reference-company fixtures, optionally filtered by name/slug.
 * Reusable by the eval harness (M4), which ingests the corpus before scoring.
 * Does not close the DB connection — the caller owns the pool's lifecycle.
 */
export async function ingestAll(filters: string[] = []): Promise<IngestResult[]> {
  const manifest = await loadManifest();
  const selected = manifest.filter((spec) => matches(spec, filters));
  const results: IngestResult[] = [];
  for (const spec of selected) {
    results.push({ company: spec.company, chunks: await ingestCompany(spec) });
  }
  return results;
}

async function main(): Promise<void> {
  const filters = argv.slice(2);
  const results = await ingestAll(filters);
  if (results.length === 0) {
    console.error(
      filters.length > 0
        ? `[ingest] no reference companies match: ${filters.join(', ')}`
        : '[ingest] fixtures/manifest.json is empty',
    );
    process.exitCode = 1;
    return;
  }
  for (const { company, chunks: count } of results) {
    console.log(`[ingest] ${company}: ${count} chunks`);
  }
}

// Run the CLI only when executed directly (not when imported by the eval/tests).
if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  try {
    await main();
  } finally {
    await sql.end();
  }
}

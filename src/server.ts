import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { runReport } from './agent';
import { getExtractions, listCompanies, searchByVector } from './db/search';
import { embedQuery } from './embeddings';

/** `?q=` is required; `?k=` (1–20) is an optional result count. */
interface SearchQuery {
  q?: string;
  k?: string;
}

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * Build the Fastify app. Async so plugins are registered *before* the routes —
 * @fastify/rate-limit installs an onRoute hook on load, so routes added before it
 * would escape the limiter. Kept as a factory so tests can `app.inject()`.
 */
export async function buildServer(
  opts: FastifyServerOptions = { logger: true },
): Promise<FastifyInstance> {
  const app = Fastify(opts);

  // Rate-limit the public endpoints (60/min/IP); exempt the health check so
  // platform probes are never throttled.
  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    allowList: (request) => request.url === '/health',
  });

  // Serve the minimal demo page (public/index.html) at the root.
  await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: '/' });

  app.get('/health', () => ({
    status: 'ok',
    service: 'ai-due-diligence-assistant',
  }));

  // Companies present in the corpus — powers the demo page's picker.
  app.get('/companies', async () => ({ companies: await listCompanies() }));

  // Cited retrieval: embed the query, then cosine top-k over the corpus. Each
  // result carries its source (company, sourceType, title, ordinal) for citation.
  app.get('/search', async (request, reply) => {
    const { q, k } = request.query as SearchQuery;
    if (!q || q.trim() === '') {
      return reply.code(400).send({ error: 'query parameter "q" is required' });
    }
    const limit = Math.min(20, Math.max(1, Number(k) || 5));
    const embedding = await embedQuery(q);
    const results = await searchByVector(embedding, limit);
    return { query: q, count: results.length, results };
  });

  // Structured, cited due-diligence report: runs the LangGraph agent over the
  // company's corpus. `:company` matches case-insensitively against ingested names.
  app.get('/report/:company', async (request, reply) => {
    const { company } = request.params as { company: string };
    const companies = await listCompanies();
    const match = companies.find((c) => c.toLowerCase().includes(company.toLowerCase()));
    if (!match) {
      return reply.code(404).send({ error: `no ingested company matches "${company}"` });
    }
    return runReport(match);
  });

  // Structured fields extracted from the company's documents (M6) — the front
  // half: unstructured filing text → typed DD fields with evidence. Same
  // case-insensitive company resolution as `/report`.
  app.get('/extract/:company', async (request, reply) => {
    const { company } = request.params as { company: string };
    const companies = await listCompanies();
    const match = companies.find((c) => c.toLowerCase().includes(company.toLowerCase()));
    if (!match) {
      return reply.code(404).send({ error: `no ingested company matches "${company}"` });
    }
    return { company: match, documents: await getExtractions(match) };
  });

  return app;
}

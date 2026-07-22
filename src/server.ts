import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { runReport } from './agent';
import { RATE_LIMIT_PER_MINUTE } from './constants';
import { getExtractions, listCompanies, searchByVector } from './db/search';
import { embedQuery } from './embeddings';

/** `?q=` is required; `?k=` (1–20) is an optional result count. */
interface SearchQuery {
  q?: string;
  k?: number;
}

interface CompanyParams {
  company: string;
}

// Route input schemas — ajv (built into Fastify) rejects malformed input with
// a 400 before the handler runs, and coerces `k` to an integer. `q` presence
// stays handler-checked so a blank `q= ` gets the same message as a missing one.
const searchSchema = {
  querystring: {
    type: 'object',
    properties: { q: { type: 'string' }, k: { type: 'integer' } },
  },
} as const;

const companySchema = {
  params: {
    type: 'object',
    properties: { company: { type: 'string', minLength: 1 } },
    required: ['company'],
  },
} as const;

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Case-insensitive match of a URL segment against the ingested company names. */
async function resolveCompany(name: string): Promise<string | undefined> {
  const companies = await listCompanies();
  return companies.find((c) => c.toLowerCase().includes(name.toLowerCase()));
}

/**
 * Build the Fastify app. Async so plugins are registered *before* the routes —
 * @fastify/rate-limit installs an onRoute hook on load, so routes added before it
 * would escape the limiter. Kept as a factory so tests can `app.inject()`.
 */
export async function buildServer(
  opts: FastifyServerOptions = { logger: true },
): Promise<FastifyInstance> {
  const app = Fastify(opts);

  // Rate-limit the public endpoints (per-IP); exempt the health check so
  // platform probes are never throttled.
  await app.register(rateLimit, {
    max: RATE_LIMIT_PER_MINUTE,
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
  app.get<{ Querystring: SearchQuery }>(
    '/search',
    { schema: searchSchema },
    async (request, reply) => {
      const { q, k } = request.query;
      if (!q || q.trim() === '') {
        return reply.code(400).send({ error: 'query parameter "q" is required' });
      }
      const limit = Math.min(20, Math.max(1, k ?? 5));
      const embedding = await embedQuery(q);
      const results = await searchByVector(embedding, limit);
      return { query: q, count: results.length, results };
    },
  );

  // Structured, cited due-diligence report: runs the LangGraph agent over the
  // company's corpus. `:company` matches case-insensitively against ingested names.
  app.get<{ Params: CompanyParams }>(
    '/report/:company',
    { schema: companySchema },
    async (request, reply) => {
      const match = await resolveCompany(request.params.company);
      if (!match) {
        return reply
          .code(404)
          .send({ error: `no ingested company matches "${request.params.company}"` });
      }
      return runReport(match);
    },
  );

  // Structured fields extracted from the company's documents (M6) — the front
  // half: unstructured filing text → typed DD fields with evidence. Same
  // case-insensitive company resolution as `/report`.
  app.get<{ Params: CompanyParams }>(
    '/extract/:company',
    { schema: companySchema },
    async (request, reply) => {
      const match = await resolveCompany(request.params.company);
      if (!match) {
        return reply
          .code(404)
          .send({ error: `no ingested company matches "${request.params.company}"` });
      }
      return { company: match, documents: await getExtractions(match) };
    },
  );

  return app;
}

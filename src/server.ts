import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { searchByVector } from './db/search';
import { embedQuery } from './embeddings';

/** `?q=` is required; `?k=` (1–20) is an optional result count. */
interface SearchQuery {
  q?: string;
  k?: string;
}

/**
 * Build the Fastify app. Kept as a factory so tests can construct an instance
 * with logging off and use `app.inject()` without binding a port.
 */
export function buildServer(opts: FastifyServerOptions = { logger: true }): FastifyInstance {
  const app = Fastify(opts);

  app.get('/health', () => ({
    status: 'ok',
    service: 'ai-due-diligence-assistant',
  }));

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

  return app;
}

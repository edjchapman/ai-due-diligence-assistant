import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

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

  return app;
}

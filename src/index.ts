import { assertProviderKeys, getConfig } from './config';
import { sql } from './db/client';
import { buildServer } from './server';

try {
  // The server embeds /search queries and reasons /report verdicts.
  assertProviderKeys('embed', 'llm');
  const app = await buildServer({ logger: true });
  const address = await app.listen({ port: getConfig().PORT, host: '0.0.0.0' });
  app.log.info(`ai-due-diligence-assistant listening on ${address}`);

  // Graceful shutdown — Railway (and docker stop) send SIGTERM: stop accepting
  // connections, drain in-flight requests, then close the pg pool.
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info(`${signal} received — shutting down`);
    await app.close();
    await sql.end();
    process.exit(0);
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      shutdown(signal).catch((err: unknown) => {
        app.log.error(err);
        process.exit(1);
      });
    });
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

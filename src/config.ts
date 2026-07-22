import { z } from 'zod';

/**
 * Central, validated runtime configuration — every `process.env` read in the
 * codebase goes through this one schema.
 *
 * Read-on-demand by design: `getConfig()` re-parses `process.env` on each call
 * instead of snapshotting at import time. Tests set provider vars in
 * `beforeAll` — *after* modules are imported — so a snapshot would freeze the
 * defaults before the test env applies. Parsing a ten-key schema is
 * microseconds; correctness wins.
 *
 * Provider polarity is deliberate, not uniform (see extract.ts): extraction
 * runs inside the *ingest* path that keyless demo/eval/CI exercise, so it and
 * the judge default to `local` — a forgotten env var must never reach for a
 * key. Embeddings and reasoning default to the real providers. The enums make
 * each default explicit, and make a typo'd value (`EMBED_PROVIDER=locel`) fail
 * loudly at parse time instead of silently selecting the wrong provider.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://postgres@localhost:5432/ai_dd'),
  PORT: z.coerce.number().int().positive().default(3000),
  EMBED_PROVIDER: z.enum(['openai', 'local']).default('openai'),
  LLM_PROVIDER: z.enum(['anthropic', 'local']).default('anthropic'),
  EXTRACT_PROVIDER: z.enum(['anthropic', 'local']).default('local'),
  JUDGE_PROVIDER: z.enum(['anthropic', 'local']).default('local'),
  PDF_PROVIDER: z.enum(['local', 'textract']).default('local'),
  EVAL_THRESHOLD: z.coerce.number().min(0).max(1).optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

/** Parse and validate the environment. Throws with a readable summary on bad values. */
export function getConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** A key-gated capability an entrypoint may exercise. */
export type Capability = 'embed' | 'llm' | 'extract' | 'judge';

const ANTHROPIC_SWITCHES = {
  llm: 'LLM_PROVIDER',
  extract: 'EXTRACT_PROVIDER',
  judge: 'JUDGE_PROVIDER',
} as const satisfies Record<Exclude<Capability, 'embed'>, keyof Config>;

/**
 * Fail fast at boot when a selected provider has no API key, instead of deep
 * inside the first request or ingest batch. Entrypoints declare only the
 * capabilities they exercise (e.g. ingest embeds and extracts but never
 * reasons, so `LLM_PROVIDER=anthropic` without a key must not stop it).
 * Called from entrypoints only — never from library modules, so
 * `buildServer()` tests and keyless paths stay assertion-free.
 */
export function assertProviderKeys(...capabilities: Capability[]): void {
  const config = getConfig();
  const missing: string[] = [];
  if (
    capabilities.includes('embed') &&
    config.EMBED_PROVIDER === 'openai' &&
    !config.OPENAI_API_KEY
  ) {
    missing.push('OPENAI_API_KEY — needed by EMBED_PROVIDER=openai (or set EMBED_PROVIDER=local)');
  }
  const anthropicUsers = capabilities
    .filter((c): c is Exclude<Capability, 'embed'> => c !== 'embed')
    .map((c) => ANTHROPIC_SWITCHES[c])
    .filter((name) => config[name] === 'anthropic');
  if (anthropicUsers.length > 0 && !config.ANTHROPIC_API_KEY) {
    missing.push(
      `ANTHROPIC_API_KEY — needed by ${anthropicUsers.map((n) => `${n}=anthropic`).join(', ')} ` +
        '(or set them to local)',
    );
  }
  if (missing.length > 0) {
    throw new Error(`missing API keys:\n  - ${missing.join('\n  - ')}`);
  }
}

# CLAUDE.md

Guidance for Claude Code (and any coding agent) working in this repository.

## What this is

**AI Due Diligence Assistant** — a portfolio project that ingests a target company's
filings, board minutes, and public commentary, runs structured due-diligence checks via a
stateful **LangGraph.js** agent, and produces an **audit-grade report with cited sources** —
plus a **CI-runnable evaluation harness** that scores its own answers.

The point isn't "call an LLM." It's to show a _system_ around one: retrieval with citations,
a stateful agent, and — the headline signal — an **evaluation loop that runs in CI** so quality
is measured, not asserted. Built deliberately in **TypeScript/Node.js** (see `docs/adr/0001`).

## Status

- **M1 — done ✅** Walking skeleton: strict-TS Fastify `/health`, Postgres/pgvector schema
  (Drizzle), docker-compose + Dockerfile, ingest stub, Vitest + typecheck **green in CI**.
- **M2 — done ✅** Ingest CLI (fixtures → chunk → OpenAI embeddings → pgvector), cosine
  top-k retrieval with citations behind `GET /search`, and a **pgvector integration test in
  CI** (deterministic vectors — no API key needed). ESLint/Prettier quality gate added.
- **M3 — done ✅** LangGraph.js agent: a node per DD check (revenue concentration, related-party,
  going-concern, auditor change) retrieves company-scoped evidence, reasons a verdict (Claude via
  the Vercel AI SDK), and returns a cited finding. `GET /report/:company` → structured report.
  Keyless demo/CI via `LLM_PROVIDER=local` (deterministic heuristic); end-to-end agent test in CI.
- **M4 — done ✅** Eval harness (`src/eval.ts`): runs the agent over the reference companies and
  scores every finding against a golden set (`src/golden.ts`) with an LLM-as-judge. `make eval` and
  a CI step print the score table and gate the build (`12/12`, keyless/deterministic). The judge is
  real Claude under `JUDGE_PROVIDER=anthropic`. **This is the headline — verification, not assertion.**
- **M5 — done ✅** Minimal demo page (`public/index.html`, served at `/`), rate-limited public
  endpoints (`@fastify/rate-limit`, 60/min/IP; `/health` exempt), keyless-by-default Railway deploy
  config (`railway.json`, `.dockerignore`, `start:prod` = migrate → ingest → serve), and a
  recruiter-readable [case study](docs/case-study.md). A green push to `main` **auto-deploys to
  Railway** via the CI `deploy` job (gated on the build job; needs a `RAILWAY_TOKEN` repo secret);
  `railway up` remains the manual fallback. `buildServer` is now async (plugins registered before routes).
- **M6 — done ✅** PDF ingestion + structured extraction (the "front half"): a real filing PDF is
  decoded (`src/pdf.ts`, keyless `unpdf`) and flows through the _same_ chunk → embed → pgvector
  pipeline, and `src/extract.ts` reads typed DD fields (mapped 1:1 to the four checks, each with an
  evidence snippet) into a `documents.extraction` jsonb column, surfaced at `GET /extract/:company`
  and in the demo. A keyless field-level **precision/recall/F1** test (`test/extract.test.ts` vs
  `src/golden-extract.ts`) rides `npm test`. The eval stays `12/12` — the PDF fixtures reinforce the
  planted signals. See [ADR 0002](docs/adr/0002-pdf-extraction.md). Textract is a documented swap.
- **M7 — done ✅** Typed React frontend: the demo is a **React 19 + Vite** app (`web/`, built into
  `public/` which Fastify serves — [ADR 0003](docs/adr/0003-react-frontend.md)). API types are
  imported type-only **from the server source** (one `Report`/`Citation`/`Extraction` definition
  across the stack); state is a discriminated-union view model with stale-response protection.
  Component tests (Testing Library + jsdom) and a built-artifact contract test (`test/ui.test.ts`)
  ride `npm test` keyless — `pretest` runs `vite build`, so `public/` is build output (gitignored;
  a dedicated Docker stage builds it for deploys). Frontend hot-reload: `npm run dev:web`.

**Provider switches (keep demos/CI keyless):** `EMBED_PROVIDER=local` (lexical embedder),
`LLM_PROVIDER=local` (heuristic reasoner), `JUDGE_PROVIDER=local` (verdict-match judge — the
**default**), and `EXTRACT_PROVIDER=local` (regex extractor — also the **default**) make `make demo`/
`make eval` and the DB tests run with no API key. `PDF_PROVIDER=local` (default `unpdf`) decodes
text-layer PDFs keyless; `PDF_PROVIDER=textract` is a documented swap, not built. For the real
semantic + LLM path: omit the embed/reasoning switches (defaults: OpenAI embeddings, Anthropic
reasoning) and set `JUDGE_PROVIDER=anthropic` / `EXTRACT_PROVIDER=anthropic` explicitly. All env
vars are validated at boot by `src/config.ts` (zod enums — a typo'd provider fails loudly), and
each entrypoint asserts the API keys for the capabilities it actually uses.

## Stack

| Layer    | Choice                                          | Why (short)                                               |
| -------- | ----------------------------------------------- | --------------------------------------------------------- |
| Language | TypeScript / Node.js (strict)                   | The type system is part of the "senior code" signal       |
| HTTP     | Fastify                                         | Typed, mature, conventional senior-Node backend           |
| DB       | PostgreSQL + pgvector via **Drizzle ORM**       | One store for relational + vector; typed, migration-first |
| Agent    | **LangGraph.js** (+ Vercel AI SDK under it)     | Stateful, inspectable graph = the interview artefact      |
| Models   | Anthropic (reasoning) + a cheap embedding model | Avoid frontier-model-for-embeddings cost trap             |
| Tests    | Vitest                                          | Also runs the eval harness in CI                          |
| Deploy   | Railway (AWS documented as the target)          | Fast public demo; AWS is a documented swap, not operated  |

Full rationale: [`docs/adr/0001-stack-and-deploy.md`](docs/adr/0001-stack-and-deploy.md).

## Repo layout

```
src/server.ts      Fastify factory (async buildServer) — /, /health, /companies, /search, /report, /extract; rate-limited
web/               React 19 + Vite demo app — typed api client (imports server types), components, jsdom tests
public/            BUILD OUTPUT of web/ (gitignored) — `npm run build:web`; served at / by Fastify
vite.config.ts     Vite config: root web/, outDir public/, dev-server proxy to :3000
railway.json       Railway deploy config (Dockerfile, /health probe)
src/index.ts       entrypoint (listen + graceful shutdown)
src/config.ts      zod-validated env config (getConfig) + per-entrypoint API-key assertions
src/chunk.ts       paragraph-aware text chunker (pure)
src/embeddings.ts  embeddings via Vercel AI SDK — OpenAI or keyless local (EMBED_PROVIDER)
src/pdf.ts         decodePdf() — text-layer PDF → text (keyless unpdf; Textract documented, PDF_PROVIDER)
src/ingest.ts      ingest CLI + ingestAll() — fixtures (md/pdf) → decode → chunk → embed → pgvector + extract
src/extract.ts     structured DD extraction — Claude generateObject or keyless regex (EXTRACT_PROVIDER; default local)
src/checks.ts      the 4 DD checks + report types (Finding, Citation, Report)
src/reasoner.ts    per-check verdict — Claude (Vercel AI SDK) or keyless heuristic (LLM_PROVIDER)
src/agent.ts       LangGraph.js graph (node per check) → runReport(company)
src/golden.ts      the golden set — expected verdicts planted in the fixtures
src/golden-extract.ts  extraction golden set — expected DD fields in each company's PDF summary
src/judge.ts       LLM-as-judge (Claude) or keyless verdict-match (JUDGE_PROVIDER)
src/eval.ts        eval harness — runEval() + CLI (`make eval`), scores vs golden
src/demo.ts        `make demo` — prints a cited audit report + extracted fields per company
src/db/schema.ts   Drizzle schema: documents (+ extraction jsonb), chunks (pgvector + HNSW index)
src/db/search.ts   cosine top-k retrieval with citations (searchByVector) + getExtractions, company-scoped
src/db/client.ts   drizzle + postgres.js client
src/db/migrate.ts  migration runner (drizzle-orm/postgres-js/migrator)
scripts/generate-pdf-fixtures.ts  `npm run fixtures:pdf` — regenerate the committed PDF fixtures (zero-dep writer)
fixtures/          reference-company docs (md + filing-summary.pdf) + manifest.json (planted DD signals)
drizzle/           generated migrations (0000 also CREATE EXTENSION vector; 0001 adds documents.extraction)
test/              Vitest specs (health/chunk/reasoner/extract/ui keyless; retrieval/agent/eval on RUN_DB_TESTS)
                   + web/src/*.test.{ts,tsx} — React component tests (jsdom), also keyless
docs/adr/          architecture decision records
```

## Dev workflow

```bash
npm ci                       # install (Node 24 / npm 11 — see guardrails)
docker compose up -d db      # Postgres + pgvector (trust-auth dev DB)
npm run db:migrate           # apply migrations (+ CREATE EXTENSION vector)
npm run ingest               # embed fixtures into pgvector (needs OPENAI_API_KEY)
npm run dev                  # Fastify on :3000
curl 'localhost:3000/search?q=going%20concern'   # cited retrieval
curl 'localhost:3000/report/helios'              # cited DD report (needs ANTHROPIC_API_KEY)
make demo                    # keyless end-to-end demo of the current milestone (prints to terminal)
make serve                   # keyless end-to-end, but serves the web UI at localhost:3000
make check                   # full gate: typecheck + lint + format + test
RUN_DB_TESTS=1 npm test      # include the pgvector integration test (needs a live DB)
```

## Guardrails (read before you push)

1. **CI must stay green. Verify locally before every push** — the loop is:
   `rm -rf node_modules && npm ci && npm run typecheck && npm test`. Don't push red.
2. **Node 24 / npm 11 everywhere** (CI + Dockerfile pinned). Node 22 ships npm 10, which
   mishandles esbuild's optional per-platform binaries (`EBADPLATFORM` on the Linux runner).
   If you change deps, regenerate the lockfile with npm 11 and clean-room `npm ci`.
3. **No secrets — ever.** The dev DB uses passwordless `trust` auth precisely so there are no
   password literals to leak. Keep real keys in `.env` (gitignored); `.env.example` stays empty.
   A secret scanner runs on commit; if it fires, fix the content, don't bypass.
4. **Keep scope lean and every layer walkable cold.** This is a deliberate TypeScript stretch;
   prefer mature SDKs over bespoke plumbing, and don't build what you can't explain in an
   interview. Corpus stays tiny (3 reference companies).
5. **The eval harness is the headline** — verification, not just generation. Treat it as at
   least as load-bearing as the demo. It must run in CI.
6. **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`). MIT licensed.

## Roadmap

### M2 — Ingest + RAG (do this next)

- Implement `src/ingest.ts`: load a small doc set for 3 reference companies (10-K excerpt,
  board-minutes sample, a news item — commit fixtures under `fixtures/`), chunk, embed via the
  Vercel AI SDK + an embedding model, and write `documents` + `chunks` (with `embedding`) to
  pgvector.
- Generate the Drizzle migration (`npm run db:generate`) and wire `CREATE EXTENSION vector`.
- Add a retrieval function (cosine top-k) and a `/search?q=` endpoint returning cited chunks.
- **CI:** add a `pgvector/pgvector:pg16` service to `ci.yml`, run the migration, and add a
  DB-integration test (insert + vector query). Keep the health/unit tests too.

### M3 — Agent + report API

- LangGraph.js graph with a node per due-diligence check (revenue concentration, related-party,
  going-concern language, auditor switch). Each check retrieves, reasons (Claude via Vercel AI
  SDK), and returns a finding **with source citations**.
- `GET /report/:company` → structured JSON report (findings + citations).

### M4 — Eval harness (the headline)

- Golden-set fixtures (expected findings for the reference companies).
- LLM-as-judge scoring of the agent's answers vs golden set; a deterministic pass/fail summary.
- Run it in CI on push; publish the score to the README (a badge or a results block).

### M5 — Deploy + demo + case study

- Deploy to Railway (mirror Foreman: one image, semver-pinned). Add a minimal demo page.
- Rate-limit the public endpoints.
- Write the recruiter-readable case study; flip the portfolio project to `Shipped`.

## Notes

- This is a portfolio artefact by [Ed Chapman](https://github.com/edjchapman). It has a private
  narrative/strategy home in the author's portfolio (the repo's `repo_url` points here from
  there — the link is one-way; don't add private context to this public repo).
- Sibling project: [Foreman](https://github.com/edjchapman/Foreman) — the event-driven
  (Python/Django) flagship. This project deliberately covers the TypeScript/Node.js side.

# AI Due Diligence Assistant

[![CI](https://github.com/edjchapman/ai-due-diligence-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/edjchapman/ai-due-diligence-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**An AI due-diligence assistant** that ingests a target company's filings, board minutes, and public commentary, runs structured due-diligence checks via a stateful **LangGraph.js** agent, and produces an **audit-grade report with cited sources** — plus a **CI-runnable evaluation harness** that scores its own answers. A portfolio project by [Ed Chapman](https://github.com/edjchapman) demonstrating end-to-end ownership of a production-shaped LLM system in **TypeScript/Node.js**: design, build, deploy, operate, evaluate.

> **Status: `M2` (ingest + cited retrieval).** Typed Fastify service, Postgres/pgvector with a real ingest → embed → cosine-retrieval path (`/search`), and a pgvector integration test in CI. The stateful agent and the eval harness land in M3–M4 (see the milestones below). The eval harness — verification, not just generation — is the headline signal.

## Why this exists

Most engineers can call an LLM API. Fewer can show a _system_ around it: retrieval with citations, a stateful agent, and — critically — an **evaluation loop that runs in CI** so quality is measured, not asserted. This project is that system, deliberately built in TypeScript/Node.js.

## Architecture (target)

```text
Ingest CLI (TS) ─▶ Postgres + pgvector (Drizzle) ─▶ Fastify API ─▶ LangGraph.js agent ─▶ Eval harness (golden + LLM-as-judge, in CI)
```

- **Fastify** typed HTTP surface (`/health`, `/search` today; `/report/:id`, `/eval/:id` in M3).
- **Postgres + pgvector** via **Drizzle ORM** — one store for relational metadata and vector retrieval.
- **LangGraph.js** stateful agent for the due-diligence checks; **Vercel AI SDK** for provider-agnostic model calls (Anthropic).
- **Eval harness** (Vitest) — golden-set + LLM-as-judge, runnable in CI.

## Quickstart

```bash
npm ci
cp .env.example .env          # set DATABASE_URL, OPENAI_API_KEY (embeddings)
docker compose up -d db       # Postgres + pgvector
npm run db:migrate            # apply schema + CREATE EXTENSION vector
npm run ingest                # embed the reference-company fixtures into pgvector
npm run dev                   # Fastify on :3000
curl 'localhost:3000/search?q=revenue%20concentration'   # cited retrieval
```

`/search?q=<query>&k=<n>` embeds the query and returns cosine top-k chunks, each
with its citation (`company`, `sourceType`, `title`, `ordinal`) and similarity score.
Ingest is idempotent per company: `npm run ingest -- helios` re-ingests just one.

## Development

```bash
npm run typecheck   # tsc (strict)
npm run lint        # eslint (type-checked)
npm test            # vitest — set RUN_DB_TESTS=1 (+ a live DB) for the pgvector round-trip
make check          # the full gate CI runs: typecheck + lint + format + test
```

## Milestones

- [x] **M1** — repo + typed Fastify skeleton (`/health`), Postgres/pgvector schema (Drizzle), Docker, CI green.
- [x] **M2** — ingest CLI + OpenAI embeddings + cited retrieval (`/search`); pgvector integration test in CI.
- [ ] **M3** — LangGraph.js DD-check agent + `/report/:id` with citations.
- [ ] **M4** — eval harness (golden + LLM-as-judge) running in CI, results in the README.
- [ ] **M5** — Railway deploy + public demo + case study.

## License

MIT — see [LICENSE](LICENSE).

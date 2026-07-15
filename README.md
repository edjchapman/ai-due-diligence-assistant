# AI Due Diligence Assistant

[![CI](https://github.com/edjchapman/ai-due-diligence-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/edjchapman/ai-due-diligence-assistant/actions/workflows/ci.yml)
[![deploy](https://img.shields.io/github/actions/workflow/status/edjchapman/ai-due-diligence-assistant/ci.yml?branch=main&label=deploy)](https://github.com/edjchapman/ai-due-diligence-assistant/actions/workflows/ci.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**▶ Live demo: <https://app-production-e60e.up.railway.app>** (keyless deterministic mode — see [API](#api)).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/demo-dark.png" />
  <img
    alt="Demo page — a cited due-diligence report for Northwind Materials with two flagged checks, source citations, and structured extracted fields"
    src="docs/images/demo-light.png"
  />
</picture>

**An AI due-diligence assistant** that ingests a target company's filings, board minutes, and public commentary, runs structured due-diligence checks via a stateful **LangGraph.js** agent, and produces an **audit-grade report with cited sources** — plus a **CI-runnable evaluation harness** that scores its own answers. A portfolio project by [Ed Chapman](https://github.com/edjchapman) demonstrating end-to-end ownership of a production-shaped LLM system in **TypeScript/Node.js**: design, build, deploy, operate, evaluate.

> **Status: `M6` (PDF ingestion + structured extraction).** The full system is in place: PDF/Markdown
> ingest → cited retrieval → a LangGraph.js agent (`GET /report/:company`) → an **eval harness that
> scores every finding against a golden set and runs in CI on every push** (see [Evaluation](#evaluation)).
> M6 adds the "front half": a real filing **PDF** is decoded (keyless) and structured into typed DD
> fields (`GET /extract/:company`), scored with a precision/recall/F1 test — see
> [ADR 0002](docs/adr/0002-pdf-extraction.md). A demo page, rate-limited endpoints, and a
> keyless-by-default Railway deploy ship here; read the [case study](docs/case-study.md). Quality is
> measured, not asserted.

## Why this exists

Most engineers can call an LLM API. Fewer can show a _system_ around it: retrieval with citations, a stateful agent, and — critically — an **evaluation loop that runs in CI** so quality is measured, not asserted. This project is that system, deliberately built in TypeScript/Node.js.

## Architecture (target)

```text
Ingest CLI (TS) ─▶ Postgres + pgvector (Drizzle) ─▶ Fastify API ─▶ LangGraph.js agent ─▶ Eval harness (golden + LLM-as-judge, in CI)
```

- **Fastify** typed HTTP surface — a demo page at `/`, plus `/health`, `/companies`, `/search`, `/report/:company`, `/extract/:company` (rate-limited). The eval harness is a CLI + CI gate, not an endpoint.
- **Postgres + pgvector** via **Drizzle ORM** — one store for relational metadata and vector retrieval.
- **LangGraph.js** stateful agent — a node per due-diligence check, each retrieving, reasoning (Claude via the **Vercel AI SDK**), and returning a cited finding.
- **Eval harness** (Vitest) — golden-set + LLM-as-judge, runnable in CI.

## Quickstart

**See it work in one command — no API key needed:**

```bash
make demo   # pgvector up → migrate → ingest → print a cited audit report per company
```

`make demo` is the milestone demo: it runs the whole pipeline end-to-end and prints an
audit report (flagged vs clear per check, with citations) for each reference company. It's
keyless by design (`EMBED_PROVIDER=local` + `LLM_PROVIDER=local`, deterministic stand-ins)
so it runs on a fresh clone with just Docker. Each milestone extends it to demo what it added.

**Prefer the browser?** `make serve` runs the same keyless pipeline but starts the server
instead of printing, so the demo page is served at **http://localhost:3000** (pick a company
to run a cited report, or search the corpus) — no API key needed.

**The real thing** (semantic embeddings + Claude, over HTTP):

```bash
npm ci
cp .env.example .env          # set DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY
docker compose up -d db       # Postgres + pgvector
npm run db:migrate            # apply schema + CREATE EXTENSION vector
npm run ingest                # embed the reference-company fixtures into pgvector
npm run dev                   # Fastify on :3000
curl 'localhost:3000/search?q=revenue%20concentration'   # cited retrieval
curl 'localhost:3000/report/northwind'                   # full cited DD report
```

- `/search?q=<query>&k=<n>` embeds the query and returns cosine top-k chunks, each cited.
- `/report/:company` runs the LangGraph agent and returns a structured report: a finding
  per check with `verdict`, `summary`, and `citations`. `:company` matches ingested names
  case-insensitively. Ingest is idempotent: `npm run ingest -- helios` re-ingests just one.

## API

All endpoints return JSON except `/`, which serves the demo page. Public endpoints are
rate-limited to **60 requests/min/IP** (a `429` with a `retry-after` header past that);
`/health` is exempt. Examples below hit the live demo — swap the base URL for `localhost:3000`
when running locally.

```
BASE=https://app-production-e60e.up.railway.app
```

### `GET /health`

Liveness probe (used by the platform; not rate-limited).

```bash
curl "$BASE/health"
# → {"status":"ok","service":"ai-due-diligence-assistant"}
```

### `GET /companies`

The companies present in the ingested corpus — useful for discovering valid `/report` targets.

```bash
curl "$BASE/companies"
# → {"companies":["Northwind Materials Inc.","Helios Robotics Corp.","Meridian Foods PLC"]}
```

### `GET /search?q=<query>&k=<n>`

Cited retrieval: embeds the query and returns cosine top-k chunks. `q` is required; `k` is
optional (1–20, default 5). `400` if `q` is missing.

```bash
curl "$BASE/search?q=related-party%20lease&k=3"
```

```jsonc
{
  "query": "related-party lease",
  "count": 3,
  "results": [
    {
      "content": "## Note 14. Related-Party Transactions … Vega Holdings LLC …",
      "ordinal": 2, // chunk index within its document
      "company": "Helios Robotics Corp.",
      "sourceType": "10-K",
      "title": "Helios Robotics — FY2025 Form 10-K (excerpt)",
      "score": 0.43, // cosine similarity, 0–1
    },
  ],
}
```

### `GET /report/:company`

Runs the LangGraph agent over one company and returns a structured, cited due-diligence report.
`:company` matches an ingested name case-insensitively (`helios` → "Helios Robotics Corp.");
`404` if none match.

```bash
curl "$BASE/report/helios"
```

```jsonc
{
  "company": "Helios Robotics Corp.",
  "generatedAt": "2026-07-07T00:10:00.000Z",
  "findings": [
    {
      "checkId": "going-concern",
      "label": "Going concern",
      "verdict": "flagged", // flagged | clear | uncertain
      "summary": "Excerpts state substantial doubt about going concern.",
      "citations": [
        {
          "company": "Helios Robotics Corp.",
          "sourceType": "10-K",
          "title": "Helios Robotics — FY2025 Form 10-K (excerpt)",
          "ordinal": 0,
          "score": 0.41,
          "snippet": "Note 2. Going Concern The Company has incurred recurring operating losses …",
        },
      ],
    },
    // … one finding per check: revenue-concentration, related-party, going-concern, auditor-change
  ],
}
```

> The live demo runs in **keyless deterministic mode** (`EMBED_PROVIDER=local`, `LLM_PROVIDER=local`).
> For real semantic retrieval + Claude reasoning, run locally (or redeploy) with `OPENAI_API_KEY` /
> `ANTHROPIC_API_KEY` and `EMBED_PROVIDER=openai` / `LLM_PROVIDER=anthropic` — same request/response
> shapes.

### `GET /extract/:company`

Returns the **structured DD fields extracted from the company's documents** (M6) — the "front
half" that turns an unstructured filing into typed data. A real filing **PDF** (`filing-summary.pdf`)
is decoded (keyless `unpdf`) and flows through the same ingest pipeline as the Markdown; each field
group maps 1:1 onto a check and carries the evidence sentence it was read from.

```bash
curl "$BASE/extract/northwind"
```

```jsonc
{
  "company": "Northwind Materials Inc.",
  "documents": [
    {
      "title": "Northwind Materials — FY2025 Filing Summary (PDF)",
      "sourceType": "filing-summary",
      "extraction": {
        "revenueConcentration": {
          "largestCustomerPct": 62,
          "largestCustomer": "Pallas Automotive Group",
          "evidence": "… 62% of total net revenue …",
        },
        "relatedParties": [],
        "goingConcern": {
          "substantialDoubt": false,
          "evidence": "… substantial doubt … does not exist.",
        },
        "auditor": {
          "changed": true,
          "auditorName": "Crestline Audit LLP",
          "evidence": "… dismissed Barrow & Finch LLP and engaged Crestline Audit LLP …",
        },
      },
    },
    // … one entry per document (extraction may be null)
  ],
}
```

> Extraction defaults to the **keyless** `local` reader (`EXTRACT_PROVIDER=local`); set
> `EXTRACT_PROVIDER=anthropic` for Claude structured extraction (`generateObject`). Accuracy is
> measured with a field-level **precision/recall/F1** test (`test/extract.test.ts`). See
> [ADR 0002](docs/adr/0002-pdf-extraction.md).

## Evaluation

The headline signal: quality is **measured, not asserted**. The harness runs the agent over
every reference company and scores each finding against a **golden set** (the expected verdicts,
planted in the fixtures) with an **LLM-as-judge**. It runs in CI on every push and fails the
build below threshold.

```bash
make eval   # keyless: ingest → run agent → score vs golden → PASS/FAIL
```

```
  Score: 12/12 (100%)  —  PASS (threshold 90%)
```

Two honest layers:

- **CI gate (keyless, deterministic):** the agent runs on the local reasoner and a verdict-match
  judge — a regression gate that proves the whole pipeline (ingest → retrieve → reason → graph →
  score) still yields the expected findings on every push. This is the `12/12` above.
- **LLM-as-judge (keyed):** scores the **real** Claude-reasoned reports, with Claude judging each
  finding for faithfulness to its cited evidence:

  ```bash
  EMBED_PROVIDER=openai LLM_PROVIDER=anthropic JUDGE_PROVIDER=anthropic npm run eval
  ```

## Demo page & deploy

A minimal demo page (served at `/`) runs a cited report per company and searches the corpus —
no build step or framework, one self-contained static HTML file calling the API (screenshot
above). Each report opens with a per-check **verdict strip**, then one card per check showing the
agent's summary, **every citation** (source · chunk · cosine score), and the **structured fields
read from the filing PDF** (`GET /extract/:company`) so the extraction corroborates the agent's
verdict side-by-side. Light/dark theme follows the OS; loading skeletons and error states are
plain CSS. Public endpoints (`/search`, `/report`, `/extract`, `/companies`) are rate-limited to
60/min/IP; `/health` is exempt for platform probes.

It's **live on Railway** at <https://app-production-e60e.up.railway.app> (config in
[`railway.json`](railway.json): one Docker image, `/health` probe). The container is **keyless by
default** (`EMBED_PROVIDER=local`, `LLM_PROVIDER=local`) — the public demo needs no API keys and
costs nothing per request; the boot command migrates, seeds the fixtures, and serves.

**Deploys are automated.** A push to `main` that passes the full build gate (typecheck, lint,
format, tests, eval) triggers the CI `deploy` job, which ships the image to Railway — so `main`
is always what's live. It needs a `RAILWAY_TOKEN` repo secret (a Railway project token); the
target service defaults to `app` (override with a `RAILWAY_SERVICE` repo variable). `railway up`
below stays available as a manual fallback.

To deploy your own (mirrors the AWS-documented target as a swap):

```bash
railway init --name ai-due-diligence-assistant
# Use a pgvector image, NOT the default Postgres addon — the migration runs CREATE EXTENSION vector:
railway add --service pgvector --image pgvector/pgvector:pg16 \
  -v POSTGRES_HOST_AUTH_METHOD=trust -v POSTGRES_DB=ai_dd -v POSTGRES_USER=postgres
railway add --service app -v "DATABASE_URL=postgres://postgres@pgvector.railway.internal:5432/ai_dd"
railway up --service app     # build the Dockerfile image and deploy
railway domain --service app # assign a public URL
```

For the **real** semantic + Claude-reasoned path in production, set `EMBED_PROVIDER=openai`,
`LLM_PROVIDER=anthropic`, and the `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` variables on the app service.

## Development

```bash
npm run typecheck   # tsc (strict)
npm run lint        # eslint (type-checked)
npm test            # vitest — set RUN_DB_TESTS=1 (+ a live DB) for the DB-backed tests
make check          # the full gate CI runs: typecheck + lint + format + test
make eval           # the eval harness (keyless)
```

## Milestones

- [x] **M1** — repo + typed Fastify skeleton (`/health`), Postgres/pgvector schema (Drizzle), Docker, CI green.
- [x] **M2** — ingest CLI + OpenAI embeddings + cited retrieval (`/search`); pgvector integration test in CI.
- [x] **M3** — LangGraph.js DD-check agent (node per check) + `GET /report/:company` with citations.
- [x] **M4** — eval harness (golden set + LLM-as-judge) scoring the agent, running in CI (`12/12`).
- [x] **M5** — demo page + rate-limited endpoints + [case study](docs/case-study.md); **deployed live on Railway** ([demo](https://app-production-e60e.up.railway.app)).
- [x] **M6** — PDF ingestion (keyless `unpdf`) + structured extraction (`GET /extract/:company`) with a field-level precision/recall/F1 test ([ADR 0002](docs/adr/0002-pdf-extraction.md)).

## License

MIT — see [LICENSE](LICENSE).

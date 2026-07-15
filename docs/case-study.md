# Case study — AI Due Diligence Assistant

**A production-shaped LLM system in TypeScript/Node.js: retrieval with citations, a stateful
agent, and — the headline — an evaluation loop that runs in CI so quality is _measured, not
asserted_.**

By [Ed Chapman](https://github.com/edjchapman) · MIT-licensed · [repository](https://github.com/edjchapman/ai-due-diligence-assistant)

---

## The problem

Most engineers can call an LLM API. Fewer can show the _system_ around one: grounded retrieval,
a stateful agent whose steps you can inspect, and a way to know — objectively, on every commit —
whether the answers are any good. This project is that system, built around a concrete task:
read a company's filings, board minutes, and public commentary, run structured due-diligence
checks, and produce an **audit-grade report with cited sources**.

## What it does

Given a target company, the assistant runs four due-diligence checks — **revenue concentration,
related-party transactions, going-concern doubt, and auditor change** — and returns a structured
report: a verdict (`flagged` / `clear` / `uncertain`) per check, a one-line summary, and the
**source citations** each verdict is grounded in.

```
  ═══ Northwind Materials Inc. ═══   (2 flags)
    ⚑ Revenue concentration   FLAGGED   Revenue concentrated in one customer (~62% of revenue).
        ↳ Northwind Materials Inc. · 10-K #1  "…sales to our single largest customer, Pallas…"
    ⚑ Auditor change          FLAGGED   The company changed its independent auditor.
    ✓ Going concern           CLEAR     No going-concern doubt; excerpts affirm the basis.
```

## Architecture

```
Ingest CLI ─▶ Postgres + pgvector ─▶ Fastify API ─▶ LangGraph.js agent ─▶ Eval harness (in CI)
   (chunk + embed)   (cosine + HNSW)    (/search,       (node per check:      (golden set +
                                         /report)        retrieve → reason      LLM-as-judge)
                                                         → cite)
```

- **Retrieval** — documents are chunked, embedded, and stored in Postgres/pgvector; queries are
  answered by cosine top-k over an HNSW index, every result carrying its citation.
- **Agent** — a **LangGraph.js** state graph with a node per check. Each node retrieves
  company-scoped evidence, reasons a verdict (Claude via the Vercel AI SDK), and appends a cited
  finding. The graph is the inspectable artefact.
- **Evaluation** — the harness runs the agent over reference companies and scores every finding
  against a **golden set** with an **LLM-as-judge**. It runs in CI on every push and fails the
  build below threshold.

## Engineering decisions that carried weight

- **The eval harness is the headline, and it's real.** It runs in CI (`12/12` on the golden set)
  and gates the build. A regression in retrieval, scoping, the graph, or the golden set turns CI
  red — verification, not a claim in a README.

- **Keyless, deterministic providers for demos, tests, and CI.** Embeddings, reasoning, and the
  judge each have a provider switch (`EMBED_PROVIDER` / `LLM_PROVIDER` / `JUDGE_PROVIDER`): OpenAI
  embeddings with Claude reasoning for production, deterministic local stand-ins otherwise. This is
  what lets the full agent and judge run in CI **without secrets**, and the public demo run **free
  and safe**.

- **A golden set with true negatives.** The fixtures were authored — three companies plus a
  **clean control** — so scoring has signal: "flag everything" scores 66%; only a system that
  correctly _clears_ the clean company and reads a _negated_ going-concern note as clear reaches
  100%. The corpus was built for the eval, not bolted on after.

- **A real extraction front-door, not just clean text in.** A filing **PDF** is decoded (keyless
  `unpdf`) and flows through the same chunk → embed → retrieve pipeline as everything else, and a
  structured-extraction stage reads typed DD fields (largest-customer %, related parties,
  going-concern doubt, auditor change) — each with the evidence sentence it came from — into the
  report. Accuracy isn't asserted: a field-level **precision/recall/F1** test scores the extractor
  against a golden set, keyless, in CI. It's the same shape as a production pipeline I built (PDF →
  structured fields via Claude, with an LLM-as-judge quality gate), re-expressed on filings and in
  TypeScript. Amazon Textract (OCR / scanned filings) is a documented swap; see
  [ADR 0002](adr/0002-pdf-extraction.md).

- **A demo UI that shows the system, not a chat box.** The public demo page is one
  self-contained static HTML file (no build step, no framework, no external requests — it works
  offline behind the rate limit). A report opens with a per-check verdict strip, then one card
  per check pairing the agent's cited verdict with the **structured fields extracted from the
  filing PDF** — two independent paths over the same source, corroborating each other on screen.
  Light/dark follows the OS; a keyless contract test in CI pins the page to the API surface it
  calls.

- **A quality gate that reads like senior code.** Strict TypeScript, type-checked ESLint,
  Prettier, and a `make check` gate mirrored in CI and a pre-commit hook. `make demo` and
  `make eval` reproduce the whole thing end-to-end in one command.

## Stack

TypeScript/Node.js (strict) · Fastify · PostgreSQL + pgvector via Drizzle ORM · LangGraph.js +
Vercel AI SDK (Anthropic + OpenAI embeddings) · Vitest · Docker · Railway (AWS documented as the
target). Full rationale in [ADR 0001](adr/0001-stack-and-deploy.md).

## Status

M1–M5 shipped and green in CI; M6 (PDF ingestion + structured extraction, with a
precision/recall/F1 test) in place. Deploy config targets Railway (one image, `/health` probe,
keyless public demo by default); see the README for the one-command deploy.

# ADR 0001 — Stack and deployment

## Status

Accepted (2026-07-06)

## Context

This is a portfolio artefact whose job is to demonstrate a production-shaped,
end-to-end AI system that a hiring manager can open and that the author can walk
through cold. It revives a previously-paused project, re-scoped to also close a
specific gap surfaced by a live role (a founding AI-native engineering seat whose
essential requirement is **senior TypeScript/Node.js in AWS**).

## Decision

- **TypeScript / Node.js** as the implementation language. The author's depth is
  Python (already evidenced by a separate event-driven project); building this in
  TS/Node converts the one profile gap into demonstrable evidence and speaks the
  stack of the teams hiring for it. Building it AI-assisted is itself a
  demonstration of "ship fast in whatever fits".
- **Fastify** for the HTTP surface — typed, mature, conventional senior-Node
  backend (over Express for first-class TS + schema validation; over Hono because
  the signal here is a conventional backend, not edge-runtime novelty).
- **Postgres + pgvector via Drizzle ORM** — one store for relational metadata and
  vector retrieval; Drizzle gives typed, migration-first schema.
- **LangGraph.js** (with the **Vercel AI SDK** underneath) for the agent — the
  stateful, inspectable graph is the interview artefact.
- **Railway** for the first public deploy — cheap, fast to a live demo. **AWS**
  (Lambda/API Gateway or ECS Fargate) is documented as the production target, a
  deliberate "documented swap" rather than operated-at-cost.

## Consequences

- The language is a deliberate stretch: scope stays lean, mature SDKs are
  preferred over bespoke plumbing, and every layer must be walkable cold.
- The eval harness (verification) is treated as the headline signal, at least as
  load-bearing as the demo itself.

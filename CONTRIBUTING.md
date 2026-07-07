# Contributing

This is a portfolio project, but issues and PRs are welcome. It's a small, deliberately lean
TypeScript/Node.js codebase — the goal is that every layer is walkable cold.

## Getting started

```bash
npm ci                       # Node 24 / npm 11
make demo                    # keyless end-to-end demo (needs Docker)
make check                   # the full gate: typecheck + lint + format + test
```

See the [README](README.md) for the architecture and API, and
[`docs/adr/0001`](docs/adr/0001-stack-and-deploy.md) for the stack rationale.

## Ground rules

- **CI must stay green.** Before pushing, run `make check` (and `RUN_DB_TESTS=1 npm test` against a
  live pgvector DB for the DB-backed tests). CI runs the same gate plus the eval harness.
- **Node 24 / npm 11.** If you change dependencies, regenerate `package-lock.json` under npm 11 and
  re-run a clean-room `npm ci`.
- **No secrets.** The dev DB uses passwordless `trust` auth by design; keep real keys in `.env`
  (gitignored). A secret scanner runs on commit.
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`).
- **Keep it lean.** Prefer mature SDKs over bespoke plumbing; don't add what you can't explain.

## Pull requests

Branch off `main`, keep the change focused, and open a PR. The template asks for what/why and how
you verified it. The keyless providers (`EMBED_PROVIDER=local`, `LLM_PROVIDER=local`) let you run
the whole system — including the eval — without any API keys.

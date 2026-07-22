# Changelog

## [0.2.0](https://github.com/edjchapman/ai-due-diligence-assistant/compare/0.1.0...0.2.0) (2026-07-22)


### Features

* clarify demo UI and add keyless make serve target ([#19](https://github.com/edjchapman/ai-due-diligence-assistant/issues/19)) ([7ec5ed1](https://github.com/edjchapman/ai-due-diligence-assistant/commit/7ec5ed14db90a0b5656a6aa955049c1d2e8ee5b6))
* M1 walking skeleton — Fastify /health, pgvector schema, CI ([9c7c6b2](https://github.com/edjchapman/ai-due-diligence-assistant/commit/9c7c6b2f584afde2f930553c069cde35df99a2b2))
* M2 — ingest CLI, OpenAI embeddings, cited pgvector retrieval ([#4](https://github.com/edjchapman/ai-due-diligence-assistant/issues/4)) ([59d032f](https://github.com/edjchapman/ai-due-diligence-assistant/commit/59d032f22e9f2324a385620742f8f3167ce91b3f))
* M3 — LangGraph.js DD-check agent + cited report API ([#6](https://github.com/edjchapman/ai-due-diligence-assistant/issues/6)) ([2ee9529](https://github.com/edjchapman/ai-due-diligence-assistant/commit/2ee9529ca73c538f8aa43b8f4e3fe616dc095bb3))
* M4 — eval harness (golden set + LLM-as-judge), scored in CI ([#7](https://github.com/edjchapman/ai-due-diligence-assistant/issues/7)) ([5a4aac5](https://github.com/edjchapman/ai-due-diligence-assistant/commit/5a4aac5d200ea692f0788c42939d05bbb807c684))
* M5 — demo page, rate-limited endpoints, Railway deploy config, case study ([#8](https://github.com/edjchapman/ai-due-diligence-assistant/issues/8)) ([6ecc2e8](https://github.com/edjchapman/ai-due-diligence-assistant/commit/6ecc2e8257e9dadfc4cb882363f4b262d885266e))
* M6 — PDF ingestion + structured extraction front-door ([#21](https://github.com/edjchapman/ai-due-diligence-assistant/issues/21)) ([f34880f](https://github.com/edjchapman/ai-due-diligence-assistant/commit/f34880f5530a6c52545b76a770773f6a070c53ee))
* make demo — keyless one-command milestone demo ([#5](https://github.com/edjchapman/ai-due-diligence-assistant/issues/5)) ([303e9c6](https://github.com/edjchapman/ai-due-diligence-assistant/commit/303e9c6209c91bf8e5446ada8b3534c853ae554a))
* rebuild demo as a typed React 19 + Vite frontend ([#30](https://github.com/edjchapman/ai-due-diligence-assistant/issues/30)) ([9c523be](https://github.com/edjchapman/ai-due-diligence-assistant/commit/9c523bec7840691732acdcb3f61e6e55c8026ab1))
* redesign demo UI with light/dark theme and extraction view ([#28](https://github.com/edjchapman/ai-due-diligence-assistant/issues/28)) ([c683079](https://github.com/edjchapman/ai-due-diligence-assistant/commit/c6830796ce2f5edc5194e84494f9545851e2323d))
* **server:** schema-validated routes, shared company resolution, rate-limit constant ([#38](https://github.com/edjchapman/ai-due-diligence-assistant/issues/38)) ([01a1aa2](https://github.com/edjchapman/ai-due-diligence-assistant/commit/01a1aa274a93f4e49923e54ae540b104f970edfd))


### Bug Fixes

* **ci:** align CI + Docker to Node 24 / npm 11 ([da4a00f](https://github.com/edjchapman/ai-due-diligence-assistant/commit/da4a00f3eb89b37cc97460c658dc6d284c751265))
* **ci:** regenerate lockfile with cross-platform esbuild binaries ([c0db01d](https://github.com/edjchapman/ai-due-diligence-assistant/commit/c0db01d833d89ff58d148db0e66a91c44c8e95a9))
* **docker:** copy tsconfig.base.json into the web build stage ([#43](https://github.com/edjchapman/ai-due-diligence-assistant/issues/43)) ([2202aa2](https://github.com/edjchapman/ai-due-diligence-assistant/commit/2202aa24b26388b6c39b69856d06bbef11d3e96e))

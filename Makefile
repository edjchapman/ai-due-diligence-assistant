.DEFAULT_GOAL := help

.PHONY: help install typecheck lint lint-fix format format-check test check demo serve eval db-up db-down

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2}'

install: ## Clean-room install (Node 24 / npm 11)
	npm ci

typecheck: ## Strict TypeScript (tsc)
	npm run typecheck

lint: ## ESLint (type-checked)
	npm run lint

lint-fix: ## ESLint autofix
	npm run lint:fix

format: ## Prettier write
	npm run format

format-check: ## Prettier check (no writes)
	npm run format:check

test: ## Vitest run
	npm test

check: typecheck lint format-check test ## Full quality gate (mirrors CI)

db-up: ## Start the pgvector dev database (waits for healthy)
	docker compose up -d --wait db

db-down: ## Stop the dev database
	docker compose down

# One command to show the current milestone working end-to-end. Keyless by design
# (EMBED_PROVIDER=local) so a reviewer can run it on a fresh clone with no API key.
# Each milestone extends src/demo.ts to demo what it added.
demo: db-up ## Demo the current milestone end-to-end (keyless; needs Docker)
	npm run db:migrate
	EMBED_PROVIDER=local EXTRACT_PROVIDER=local npm run --silent ingest
	EMBED_PROVIDER=local LLM_PROVIDER=local npm run --silent demo

# Same keyless pipeline as `demo`, but instead of printing to the terminal it
# starts the Fastify server so the web UI (public/index.html) is served at /.
# Sibling to `demo` (kept headless/CI-friendly), not a replacement.
serve: db-up ## Serve the web UI end-to-end at http://localhost:3000 (keyless; needs Docker)
	npm run db:migrate
	EMBED_PROVIDER=local EXTRACT_PROVIDER=local npm run --silent ingest
	@printf '\n  Web UI → http://localhost:3000  (Ctrl-C to stop)\n\n'
	EMBED_PROVIDER=local LLM_PROVIDER=local npm run dev

eval: db-up ## Run the eval harness against the golden set (keyless; needs Docker)
	npm run db:migrate
	EMBED_PROVIDER=local EXTRACT_PROVIDER=local LLM_PROVIDER=local JUDGE_PROVIDER=local npm run --silent eval

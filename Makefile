.DEFAULT_GOAL := help

.PHONY: help install typecheck lint lint-fix format format-check test check check-commit-msg demo serve eval db-up db-down

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

# Deliberately DB-free and fast — it runs on every commit via pre-commit. CI
# runs this same gate *plus* the DB-gated suites (RUN_DB_TESTS=1) and the eval
# harness; run those locally with `make db-up && RUN_DB_TESTS=1 npm test` and
# `make eval`.
check: typecheck lint format-check test ## Static quality gate (CI adds DB suites + eval)

# CI validates the PR title with the same script (commit-style.yml) — under
# squash-merge the title becomes the permanent commit subject.
check-commit-msg: ## Validate the last commit subject (Conventional Commits)
	git log -1 --format=%s | ./scripts/check-commit-msg.sh --stdin --strict

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
# builds the React demo (web/ → public/) and starts the Fastify server so the
# UI is served at /. Sibling to `demo` (kept headless/CI-friendly), not a
# replacement. For frontend hot-reload, run `npm run dev:web` alongside.
serve: db-up ## Serve the web UI end-to-end at http://localhost:3000 (keyless; needs Docker)
	npm run db:migrate
	EMBED_PROVIDER=local EXTRACT_PROVIDER=local npm run --silent ingest
	npm run --silent build:web
	@printf '\n  Web UI → http://localhost:3000  (Ctrl-C to stop)\n\n'
	EMBED_PROVIDER=local LLM_PROVIDER=local npm run dev

eval: db-up ## Run the eval harness against the golden set (keyless; needs Docker)
	npm run db:migrate
	EMBED_PROVIDER=local EXTRACT_PROVIDER=local LLM_PROVIDER=local JUDGE_PROVIDER=local npm run --silent eval

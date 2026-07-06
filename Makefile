.DEFAULT_GOAL := help

.PHONY: help install typecheck lint lint-fix format format-check test check demo eval db-up db-down

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
	EMBED_PROVIDER=local npm run --silent ingest
	EMBED_PROVIDER=local LLM_PROVIDER=local npm run --silent demo

eval: db-up ## Run the eval harness against the golden set (keyless; needs Docker)
	npm run db:migrate
	EMBED_PROVIDER=local LLM_PROVIDER=local JUDGE_PROVIDER=local npm run --silent eval

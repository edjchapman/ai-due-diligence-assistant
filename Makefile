.DEFAULT_GOAL := help

.PHONY: help install typecheck lint lint-fix format format-check test check

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

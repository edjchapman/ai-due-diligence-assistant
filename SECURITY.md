# Security Policy

## Reporting a vulnerability

Please report security issues privately via
[GitHub's private vulnerability reporting](https://github.com/edjchapman/AI-Due-Diligence-Assistant/security/advisories/new)
(Security → Report a vulnerability), rather than opening a public issue.

I'll acknowledge the report as soon as I can and keep you updated on any fix.

## Scope & notes

- This is a portfolio project. The public demo runs in **keyless deterministic mode** (no API keys),
  and the dev/deploy database uses passwordless `trust` auth on a private network by design — there
  are deliberately no secrets committed to the repository.
- Dependencies are monitored via Dependabot; a known dev-only, transitive `esbuild`/`drizzle-kit`
  advisory is accepted and does not affect runtime.

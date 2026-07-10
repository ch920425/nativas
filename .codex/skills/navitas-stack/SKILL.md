---
name: navitas-stack
description: Use when implementing, debugging, testing, or deploying navitas.ai integrations across Hermes Agent, Convex, Cloudflare, Linkup, Dodo Payments, or the project-isolated gbrain knowledge base.
---

# navitas.ai stack

Use this repo-local skill for service integration work. Keep it small: load only the relevant sections of [service-contracts.md](references/service-contracts.md), then implement the narrowest end-to-end slice that proves the product contract.

## Non-negotiable routing

- Hermes is the runtime agency manager. It plans, chooses evidence, delegates localization judgment, reconciles work, and decides whether to publish.
- The relay and Convex perform deterministic transport, validation, idempotency, and persistence only. They must not become a second semantic orchestrator.
- **Linkup is the only web-search provider in this repository. Never use Exa.** Do not add Exa packages, MCPs, environment variables, fallbacks, or documentation.
- Do not use Hermes' generic web-search backends or Cloudflare Web Search for product research. Route live market search through the narrow Linkup tool.
- Cloudflare Browser Run may capture the user-submitted site and discovered same-site locale URLs. That is evidence acquisition, not general web search.
- gbrain must use a project-specific, absolute `GBRAIN_HOME`; never read or write the user's personal brain for navitas.ai.
- Keep Hermes loopback-only. Browser clients must communicate through the application backend, never directly with the Hermes gateway.
- Never commit credentials, `.env*` values, webhook secrets, bearer tokens, customer page contents, or unredacted traces.

## Build workflow

1. Identify the one service boundary being changed and read its section in the reference.
2. Check the relevant CLI and authentication gate before writing integration code.
3. Preserve the ownership boundaries and shared identifiers (`auditId`, `runId`, `artifactId`, `reportVersion`, webhook event ID).
4. Add or update realistic contract tests for the changed boundary. Test retries, duplicates, timeouts, and invalid payloads when applicable.
5. Run the smallest proof first, then the affected package tests, typecheck, and lint.
6. Report manual gates explicitly. Do not conceal a missing login, product ID, deployment, or provider behind canned success data.

## Scope discipline

- Target one source/target homepage pair, three strong findings, and a capped paid continuation.
- Prefer one real call over multiple decorative integrations.
- Reuse the existing schema and helpers before adding abstractions or dependencies.
- Delete superseded experiments, fixtures, and tests in the same change.
- Do not add alternate browsers, search providers, databases, queues, or agent orchestrators without an explicit architecture decision.
- A fallback may degrade honestly or stop with a typed error; it must never fabricate agent progress, search evidence, capture artifacts, payment success, or retrieval hits.

## Required verification

Run the service checks in [service-contracts.md](references/service-contracts.md#verification-matrix). A change is not complete when its relevant live/manual gate remains untested; record the exact gate and the next command instead.

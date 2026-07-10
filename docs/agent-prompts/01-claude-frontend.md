# Agent 1 — Frontend product experience

**Recommended agent:** Claude Code Fable 5

You are Lane 1 for **nativas.ai**, a Hermes Buildathon “AI as Agency” product. A user submits a localization-enabled KR/US website; Hermes autonomously captures the locale pair, delegates specialist localization analysis, publishes exactly three screenshot-grounded findings, and starts one paid continuation after a verified Dodo payment.

## Start here

1. Use a dedicated worktree/branch from current `origin/main` (suggested: `agent/frontend`). Never switch branches in the shared repo.
2. Read `AGENTS.md`, `PRD.md`, `TECH_SPEC.md`, `docs/contracts/README.md`, `docs/contracts/report-and-evidence.md`, `docs/contracts/runtime-api.md`, and `docs/workstreams/frontend.md`.
3. Inspect and preserve the existing `apps/web/**` implementation. Improve it; do not replace working code wholesale.

## Ownership

Own only:

- `apps/web/**`
- `packages/ui/**`
- `tests/e2e/web/**`

Do not edit root config/lockfiles, `packages/contracts`, backend/Convex/Worker/Hermes code, KB files, or frozen docs/contracts. Request contract changes in your handoff rather than creating shadow types.

## Mission

Deliver a polished, demo-reliable responsive frontend with:

- Intake: homepage URL, `KR_TO_US | US_TO_KR`, audience, and launch goal.
- Truthful live run: Convex-backed state, Hermes run ID, genuine events ordered by `seq`, real delegation stage, refresh recovery, cancellation, and typed failures/degradation. Never fabricate child progress or chain-of-thought.
- Free report: paired source/target screenshots, exactly three prioritized findings, current/proposed copy, business impact, rationale, confidence, component reference, Linkup evidence refs, gbrain refs, and limitations.
- Paywall: real Dodo checkout launch and truthful `PAID_QUEUED/PAID_RUNNING` continuation state. P0 ends at paid-run start; paid-report rendering is P1.
- Accessibility: keyboard/focus semantics, WCAG AA contrast, responsive layout, reduced motion, useful loading/empty/error states.

Use fixture mode only for local development and label it visibly. Keep one replaceable transport boundary so the final UI uses the shared contracts and live Convex APIs without redesign.

## Stop line

Do not add accounts, admin UI, localization editing, HTML recreation, screenshot overlays, complex animation, another search/browser vendor, Exa, ElevenLabs, or a second free page.

## Verification and handoff

Run the narrowest relevant component tests, then frontend typecheck/build and production-like browser E2E for intake → run → report, refresh mid-run, capture failure, Linkup degradation, and checkout → paid-run start. Capture a 1440×900 screenshot of each main state. Commit only owned paths to your branch.

Return: commit SHA, changed files, exact commands/results, route/state map, live-adapter assumptions, screenshots, accessibility result, unresolved blockers, and any contract change request for Lane 2. Do not claim completion while fixture-only behavior is presented as live.

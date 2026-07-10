# Lane 1 — Claude Code frontend UI/UX

## Mission and ownership

Deliver intake, truthful live-run, visual report/paywall, and paid-start screens against contract v1. Own only `apps/web/**`, `packages/ui/**`, and `tests/e2e/web/**`.

## Requirements

- Import `packages/contracts`; create no shadow types.
- Develop against canonical fixtures through a replaceable transport adapter; fixture mode is local/test-only and labeled.
- Intake accepts URL, direction, audience, and goal with exact scope disclosure.
- Live UI orders genuine Convex events by `seq`, shows Hermes/run IDs and native `delegate_task`, and never estimates child state or progress.
- Report shows paired screenshots and exactly three findings with current/proposed copy, impact, rationale, confidence, evidence, KB refs, and limitations.
- Paywall launches real Dodo checkout and shows the newly created paid audit/run after verified payment. P0 ends at truthful paid-run start; rendering a completed paid report is P1.
- Cover loading, empty, degraded, failed, cancelled, payment-delayed, and refresh-recovered states.
- Meet WCAG AA, keyboard/focus, semantic landmark, and reduced-motion requirements.
- Do not add overlays, after-state mocks, accounts, admin console, or complex animation.

## Tests and handoff

Component tests use canonical fixtures. Browser E2E covers submit→events→report, refresh mid-run, capture failure, Linkup-degraded report, checkout→paid start, and automated accessibility on all screens. Handoff includes route map, environment placeholders, fixture/live switch, commands/output, accessibility results, and 1440×900 screenshots. Done means the live Convex adapter passes without fixture mode.

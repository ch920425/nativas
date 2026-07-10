# Lane 1 frontend session log

## Milestone 1 — Research and design-library decision (2026-07-10)

**Chosen library: `@base-ui/react` v1.6.0** (released 2026-06-18, MUI/Radix/Floating UI team).

- Researched via exa (web + code context), context7 (`/mui/base-ui` docs), and npm registry release dates.
- Alternatives considered: `react-aria-components` 1.19.0 (also 2026-06-18; strong, but heavier API), HeroUI v3 (beta, requires Tailwind v4 migration), Reshaped v4 (imposes its own visual system), assorted new shadcn-derivatives (unproven, near-zero adoption).
- Rationale: headless + data-attribute styling preserves the existing editorial design language; stable 1.x from a proven a11y-focused team; Field/Fieldset/Form validation wiring, Dialog focus management, and RadioGroup keyboard semantics directly serve the WCAG AA requirement; no animation system pulled in (stop-line safe).
- Known gate: `grok` CLI returned 403 (chat endpoint denied for current credentials) — consult skipped, documented per tool-failure policy.
- npm note: `workspace:*` protocol is unsupported by npm 12 for dependency adds; changed `apps/web/package.json` to `"@nativas/contracts": "*"` (equivalent workspace link). Root `package-lock.json` was regenerated mechanically by the dependency add — flagged for Lane 2 review.

## Milestone 2 — Core experience rebuilt on the transport boundary (2026-07-10)

Deadline-scoped decisions (25-minute ship window announced mid-session): no `packages/ui`
package, no Playwright E2E (vitest + Testing Library covers every product flow; browser
E2E is the top follow-up), screens kept in `App.tsx`.

- `lib/contracts.ts`: view types aligned with `docs/contracts/report-and-evidence.md`
  Finding v1 (componentRef, issueType, severity, confidence). **Contract change request
  for Lane 2:** `packages/contracts` Finding lacks these fields; the view type documents
  the gap instead of forking the contract.
- `lib/validateUrl.ts`: client pre-flight for public http(s) only — blocks credentials,
  loopback, RFC1918, link-local/metadata, `.local`/`.internal` (backend stays authoritative).
- `data/fixtureTransport.ts`: progressive fixture engine — contract-legal transitions via
  `canTransition`, server-style monotonic `seq`, sessionStorage persistence (refresh
  recovery), URL-keyword scenarios (`capture-fail`, `blocked`, `degraded`, `slow-pay`),
  cancellation at next safe point, idempotent checkout, exactly-one paid audit + run,
  truthful delayed-webhook state.
- `data/transport.ts`: single swap point; `VITE_TRANSPORT=live` reserved for Lane 2's
  Convex adapter.
- `App.tsx`: hash routes (`#/audit/:id`) so refresh restores by ID; screens derived from
  audit status only. Base UI in use: Field/Fieldset (intake), RadioGroup/Radio
  (direction), Dialog (Dodo checkout hand-off with focus management).
- Accessibility: skip link, landmarks, labelled sections, `role="log"` live event feed,
  `role="status"` recovery/payment notices, keyboard-native controls, reduced-motion kept.
- Tests: 36 tests across URL policy, transport lifecycle (happy/degraded/typed
  failures/cancel/refresh/idempotent payments), and full UI flows including
  checkout → paid-run start and delayed webhook. jsdom `PointerEvent` polyfill added
  for Base UI activation events.

## Milestone 3 — Verification results and known gaps (2026-07-10)

Verified fresh:
- `npx vitest run` → 3 files, **36/36 passed** (~1.5s).
- `npm run build` (`tsc -b && vite build`) → clean.
- Branch `agent/frontend` pushed to origin.

Known gaps (deadline-scoped, honest):
- **No Playwright browser E2E and no 1440×900 screenshots.** The gstack browse
  daemon was killed by the environment (exit 137, twice) and the Chrome extension
  is not connected. All five demo flows are covered by jsdom component tests
  instead. Follow-up: run `npx vite --port 5199` in `apps/web` and capture
  intake / run / report / degraded / failure / paid states in a real browser.
- **Live adapter not wired** (Lane 2 owns Convex): `data/transport.ts` is the single
  swap point; implement `AuditTransport` and flip `VITE_TRANSPORT=live`.
- **Contract change request for Lane 2:** extend `packages/contracts` Finding/Report
  with the report-and-evidence.md v1 fields (severity, issueType, componentRef,
  current/proposed copy, businessImpact, confidence, evidenceRefs, kbRefs,
  liveMarketEvidence, limitations). `apps/web/src/lib/contracts.ts` documents the
  exact shapes the UI consumes.
- WCAG AA contrast reviewed by token choice (light-on-dark ≥ 4.5:1 for body text);
  automated axe pass is a follow-up alongside browser E2E.
- grok CLI remains a manual auth gate (403 from cli-chat-proxy.grok.com).

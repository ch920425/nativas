# Lane 1 frontend session log

## Milestone 1 — Research and design-library decision (2026-07-10)

**Chosen library: `@base-ui/react` v1.6.0** (released 2026-06-18, MUI/Radix/Floating UI team).

- Researched via exa (web + code context), context7 (`/mui/base-ui` docs), and npm registry release dates.
- Alternatives considered: `react-aria-components` 1.19.0 (also 2026-06-18; strong, but heavier API), HeroUI v3 (beta, requires Tailwind v4 migration), Reshaped v4 (imposes its own visual system), assorted new shadcn-derivatives (unproven, near-zero adoption).
- Rationale: headless + data-attribute styling preserves the existing editorial design language; stable 1.x from a proven a11y-focused team; Field/Fieldset/Form validation wiring, Dialog focus management, and RadioGroup keyboard semantics directly serve the WCAG AA requirement; no animation system pulled in (stop-line safe).
- Known gate: `grok` CLI returned 403 (chat endpoint denied for current credentials) — consult skipped, documented per tool-failure policy.
- npm note: `workspace:*` protocol is unsupported by npm 12 for dependency adds; changed `apps/web/package.json` to `"@navitas/contracts": "*"` (equivalent workspace link). Root `package-lock.json` was regenerated mechanically by the dependency add — flagged for Lane 2 review.

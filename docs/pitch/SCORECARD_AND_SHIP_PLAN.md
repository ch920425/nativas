# nativas.ai — score-max and production playbook

The handbook makes one fact decisive: no public URL means the build does not count, and a staged surface caps the highest-weight “working product” parameter. The operating priority is therefore **public job completion first, proof second, polish third**.

## Objective scorecard

This assessment distinguishes the current unmerged state from the evidence target. Specifications and unit tests do not earn product points by themselves.

| AI as Agency parameter | Weight / max | Current judgeable state before integration | 30-minute evidence target | Target points |
|---|---:|---|---|---:|
| Working product shipping real output | 20 / 80 | L1–L2: main still uses fixtures; no public production run verified | L5: 3+ fresh end-to-end runs, at least 85% success, no approval on normal path | 80 |
| Agent organization | 5 / 20 | L2 on evidence; architecture targets manager + specialists | L4: two inputs produce visibly different plans; one manager revision is recorded | 15 |
| Observability | 7 / 28 | L2–L3 after merge if event timeline works | L3 minimum; L4 only if trace tree plus per-step token/cost is real | 14–21 |
| Eval and iteration | 5 / 20 | L2: tests exist, but agent-quality eval evidence is not yet judgeable | L3: named golden eval set, versioned prompt/skill IDs, saved run results | 10 |
| Handoffs and memory | 2 / 8 | Strong contract, unverified live | L4: bounded evidence survives specialists; free report context survives into paid child audit | 6 |
| Cost and latency | 1 / 4 | L1 until measured | L4: each valid report under 5 minutes and under $0.50 | 3 |
| Management UI | 1 / 4 | L1–L2; customer UI is not an agent-management UI | Hold at L2; do not spend core time chasing this low-weight parameter | 1 |
| **Base target** | **164 max** | — | — | **129–136** |

Power-up target: Convex + Linkup + Dodo Payments + Cloudflare + Wispr Flow = **125 points**. Skip ElevenLabs because forced voice work would dilute the product. Real use must be visible to a mentor and judge; an account or logo alone earns nothing.

Realistic score target after verified production: **254–261 before cross-track bonuses**. This is an execution target, not a guaranteed placement.

## Highest-ROI moves, in order

1. Ship the merged build to a public `*.pages.dev` URL. Do not wait for custom-domain DNS.
2. Complete three autonomous production audits and save a ledger with input, outcome, duration, cost, and report URL.
3. Demonstrate two different request-specific Hermes plans and one recorded manager revision.
4. Keep one matching audit ID visible across the product, Hermes trace, Convex, Cloudflare artifact, and Linkup evidence.
5. Open a real Dodo checkout and verify duplicate webhook delivery creates only one paid child audit.
6. Dictate 500+ real build/pitch words with Wispr and save its stats screenshot.
7. Ask a mentor to witness each of the five power-ups before final judging.
8. Only after all of the above, connect `nativas.ai` and recruit external users for cross-track signup/revenue evidence.

Do not add ElevenLabs, authentication, a management console, multi-page free crawling, automated golden-set promotion, or Hermes Cloud migration before the proof run succeeds.

## Integration and deploy clock

### T−30 to T−24: freeze and integrate

- Stop feature additions. Merge frontend, backend/Hermes, and knowledge-base branches into one integration branch.
- Resolve contracts centrally; do not let lanes invent adapters independently.
- Run the repo validator, Hermes spec validator, targeted tests, typecheck, and production build.
- Search tracked files for the retired product spelling. The product is **nativas.ai**; local worktree folder names may remain unchanged until active worktrees are removed.

### T−24 to T−18: production backend and runtime

- Deploy the Convex production backend with `npx convex deploy`; set production environment variables in Convex, never in Git.
- Start the dedicated local Hermes gateway and outbound relay. The judge-facing site talks to Convex; the relay polls Convex from the laptop, so Hermes does not need an inbound public port.
- Keep the laptop awake, on power, and on stable Wi-Fi. Run gateway and relay in separate persistent terminal panes and save logs.
- Verify one real Linkup query, one Cloudflare Browser Rendering capture, R2 artifact persistence, and one report submission before touching Dodo.

### T−18 to T−13: public URL

- Re-authenticate Wrangler interactively with `wrangler login` or configure a scoped `CLOUDFLARE_API_TOKEN` outside the repo.
- Build the web app and deploy the output directory:

```bash
npm run build --workspace @nativas/web
npx wrangler pages deploy apps/web/dist --project-name nativas-ai --branch main
```

- Open the returned `https://nativas-ai.pages.dev` URL from a phone on cellular data. This is the submission fallback and already satisfies the public-URL requirement.
- Add `nativas.ai` only if the domain is owned and its apex zone/nameservers are already under the same Cloudflare account. Keep the `pages.dev` URL available even after the custom domain works.

### T−13 to T−7: payment and repeated runs

- Create/open the real Dodo checkout. Use its test mode only if the event explicitly permits test checkout as real product use; otherwise perform the smallest legitimate payment.
- Replay the webhook once and prove the idempotency key prevents a second child audit.
- Run three prevalidated public sites end to end. A run passes only when it produces exactly three evidence-linked findings and has no unhandled exception.
- Record success rate, median duration, and model/tool cost. Do not claim a latency or accuracy tier without these measurements.

### T−7 to T−3: judge proof setup

- Pin tabs in pitch order: product, run ledger, Hermes trace, Convex, Cloudflare, Linkup, Dodo, Wispr.
- Use one audit ID in every dashboard and log view.
- Prepare one completed production run as the honest fallback if the fresh run exceeds the two-minute demo window.
- Prepare one typed unsafe-URL failure and one screenshot of the finished report.

### T−3 to T0: rehearsal and submission

- Rehearse twice with a timer. The product demo ends at 2:00 and proof ends at 3:00.
- Test the live URL from another device and network.
- Record a backup screen capture of the successful four-minute flow.
- Submit the live URL before the deadline; do not submit slides or a repository URL as the product.

## Minimal run ledger

Use a Convex-backed proof view if it already exists; otherwise a clearly visible table generated from real run records is enough.

| Run | Public input | Plan ID | Result | Findings | Duration | Cost | Report |
|---|---|---|---|---:|---:|---:|---|
| 1 | KR → US SaaS | skill/prompt version | PASS/FAIL | 3 | measured | measured | live link |
| 2 | US → KR SaaS | skill/prompt version | PASS/FAIL | 3 | measured | measured | live link |
| 3 | Different page structure | skill/prompt version | PASS/FAIL | 3 | measured | measured | live link |

## Hard go/no-go gates

- **Go:** phone on cellular can submit a URL, observe durable progress, and open a valid report.
- **Go:** the report comes from the real Hermes path and real evidence tools, not fixture transport.
- **Go:** three runs and their durations/costs are visible.
- **Go:** Convex, Linkup, Dodo, and Cloudflare each perform real work that can be shown.
- **No-go:** public frontend points at local-only state or fixture transport.
- **No-go:** a partner logo is shown without a matching query, state row, checkout, artifact, or dashboard event.
- **No-go:** claims of 85%+, sub-minute, or sub-$0.10 performance without a recorded denominator and measurements.

## Current external blockers discovered before integration

- `nativas.ai` does not currently resolve in DNS. Treat `nativas-ai.pages.dev` as the required submission URL until ownership and Cloudflare zone configuration are confirmed.
- Wrangler is installed but its login token is expired. Re-authentication is required before Pages/Worker deployment.
- Linkup CLI is installed but was not authenticated in the planning shell. Validate `LINKUP_API_KEY` in the runtime environment before counting the power-up.

No plan can guarantee a win or a production deployment without service credentials and working third-party APIs. This playbook maximizes score by proving the handbook’s highest-weight behaviors and keeping every claim auditable.

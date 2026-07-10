# nativas.ai — Hermes-powered localization agency for KR ↔ US launches

**Buildathon track:** AI as Agency
**Status:** build-ready, ruthlessly scoped 3.5-hour MVP
**One-line pitch:** Submit a localization-enabled website. A Hermes-managed specialist agency audits the Korean and English homepages in their real visual and market context, publishes three cited localization recommendations, and automatically starts a deeper engagement after payment.

## 1. Product decision

Build an autonomous localization agency, not a translation widget, generic crawler, or human-assisted consulting workflow.

The judged MVP has one narrow end-to-end path:

1. A user submits one public homepage and selects `KR → US` or `US → KR`.
2. nativas.ai verifies a public source/target locale pair.
3. Cloudflare Browser Run captures both pages and stores visual evidence in R2.
4. A Hermes parent run retrieves one curated gbrain packet and one fresh Linkup market-evidence packet.
5. Hermes chooses and delegates up to three bounded specialist tasks, reconciles them, and publishes exactly three high-impact findings.
6. Convex streams truthful run state and serves the report.
7. Dodo Payments verifies checkout and automatically starts one new, context-linked paid Hermes run covering at most two additional content surfaces, each represented by one source/target locale pair.

The experience is fully autonomous after URL submission. There is no human approval, hidden copy editor, Lokalise integration, authenticated crawl, CAPTCHA bypass, or automatic deployment into the customer website.

## 2. Problem

Companies entering a new market often localize strings without the current page, component, product journey, or buying context. The result may be grammatically correct while still feeling foreign, vague, risky, or commercially weak.

The source workflow identifies recurring failures:

- Translators receive isolated strings and stale or missing screenshots.
- Headlines and value propositions preserve words but lose market relevance.
- CTAs ignore local trust and conversion conventions.
- Feature, plan, and product terminology drifts across surfaces.
- Copy no longer fits the component or visual hierarchy.
- Requests arrive late, and no one performs a holistic consistency pass.

These failures are most expensive on the homepage, where unfamiliar phrasing can erode trust before a prospect understands the product. Existing localization platforms assume string catalogs, engineering integrations, and an established localization team. nativas.ai starts from the public website every company already has and delivers the first agency engagement without a human operator.

## 3. Why nativas.ai is differentiated

nativas.ai does not ask, “How should this sentence be translated?” It asks:

> Given this company, audience, component, visual hierarchy, product claim, destination market, and comparable evidence, what copy would feel native while preserving meaning?

Its advantage comes from combining:

- **Live visual context:** rendered source and target pages, not isolated strings.
- **Fresh market context:** one bounded Linkup query with cited current sources.
- **Curated institutional memory:** a project-specific gbrain of reviewed localization decisions and anti-patterns.
- **Autonomous specialist work:** Hermes plans, delegates, critiques, reconciles, and publishes.
- **Compounding knowledge:** completed audits create provenance-linked candidate records; only reviewed candidates are promoted into the golden set.
- **Service continuation:** a verified payment hires the agency again without an operator restarting the workflow.

## 4. Target user and job

### Initial customer

- A Korean company preparing its US-facing website.
- A US company preparing its Korean-facing website.
- A founder, marketer, product manager, or localization owner who can provide a public homepage URL but does not have time to coordinate a full agency engagement.

### Job to be done

“Show me the few localization problems most likely to undermine trust or conversion, explain them in the context of the actual page and market, give me stronger copy I can act on, and continue into a deeper audit without requiring me to manage a team.”

## 5. Scope

### Must ship

- One public source/target homepage pair.
- Direction selector: `KR → US` or `US → KR`.
- Real Hermes Runs API parent execution and one genuine native delegation batch.
- Exactly three strong homepage findings.
- Source and target screenshots plus rendered evidence.
- Six reviewed gbrain records: three per direction, focused on hero/value proposition, CTA, and trust language.
- One Linkup `standard` structured search per audit; Linkup is the only web-search provider.
- Convex-backed intake, run events, report state, and payment state.
- Cloudflare Pages, Browser Run, and R2 doing real product work.
- Real Dodo checkout, verified and idempotent webhook handling, and automatic paid continuation.
- Paid demo capped at two additional eligible content surfaces, each represented by one source/target locale pair.
- Mechanical report validation and typed failures.
- One completed free-audit → verified-payment → automatic-paid-run-start rehearsal and repeated free-run proof.

### Ship only if ahead

- Detailed child lifecycle telemetry through a Hermes plugin.
- An explicit `report_progress` tool.
- Screenshot coordinate overlays.
- A naturally triggered repair delegation.
- A second prevalidated website fixture.
- A completed capped paid report with screenshots for both additional pages.
- Lightweight operator controls beyond cancellation and retry.

### Cut now

- A second free page.
- More than two paid content surfaces (four captured locale URLs).
- Linkup `deep` on the live path.
- Exa in development, corpus preparation, runtime, or fallback search.
- Cloudflare `/crawl` as a dependency.
- Interactive locale-selector automation.
- Recreated static HTML or visual “after” pages.
- Migration of the user's existing personal Hermes agent/profile into hosted Hermes Cloud.
- A custom domain as proof of Cloudflare usage.
- ElevenLabs, subscriptions, accounts, admin builders, or a large design system.
- Any second browser, search, workflow, vector, queue, or database vendor.

### Post-hackathon

- Broader public-site coverage with transparent crawl limits.
- Documentation, feature-launch, and redesign engagements.
- Reviewed promotion of high-quality audit decisions into gbrain.
- Multi-device gbrain on Postgres/pgvector.
- Interactive locale traversal, geographic sessions, visual before/after previews, and human review workflows.
- Production authentication, billing portal, organization management, and a persistent hosted Hermes runtime.

## 6. End-to-end experience

### 6.1 Intake

The landing page asks for:

- Main homepage URL.
- Direction: `KR → US` or `US → KR`.
- Optional destination audience or launch objective.

The system accepts only public `http` or `https` URLs, blocks private/link-local/loopback/metadata destinations, limits redirects and response size, and verifies a source/target locale relationship through direct links, locale routes, subdomains, query parameters, or `hreflang`. The MVP accepts only direct locale candidates on the submitted registrable domain. It validates each submitted/discovered URL, DNS result, and server-side preflight redirect hop before invoking Browser Run. The Quick Action path does not claim interception of browser-internal redirects or subresource requests; stricter per-request enforcement is post-hackathon.

If the relationship cannot be verified, the job fails with the attempted URLs and a typed reason. The MVP does not click complex language selectors.

### 6.2 Live agency run

The user sees truthful evidence that Hermes—not the web app—is doing the work:

- Hermes run ID and status.
- The manager’s site-specific plan.
- Real capture, retrieval, Linkup, delegation, and report tool events.
- The genuine `delegate_task` payload showing the selected specialist roles.
- Elapsed time and tokens/cost when exposed by the validated Hermes event stream.
- Cancellation and typed failure states.

Native Runs SSE is sufficient for the critical path. The UI must not invent child progress. If detailed child hooks are unavailable, it shows one active `delegate_task` stage and the returned specialist summaries.

### 6.3 Free visual report

The report contains exactly three prioritized findings. Each finding includes:

- Page URL and immutable artifact reference.
- Component label and selector or accessibility identity when available.
- Current localized copy.
- Proposed localized copy.
- Issue type and severity.
- Business impact.
- Contextual and cultural rationale.
- Confidence.
- Linkup source URLs.
- gbrain record IDs that influenced the decision.

The report pairs source and target screenshots with the finding panel. Geometry and numbered overlays are nullable stretch enhancements; screenshots and component-linked evidence are mandatory. A limitations section states what was checked, what was inaccessible, and that recommendations are proposed changes rather than deployed changes.

### 6.4 Paywall and continuation

The locked section previews deeper coverage and opens a real one-time Dodo checkout. A public Convex HTTP Action verifies the Dodo signature and deduplicates the webhook ID. `payment.succeeded` leaves the free audit at `FREE_REPORT` and atomically creates exactly one linked `PAID_QUEUED` child audit.

The relay starts a new Hermes run with an explicit continuation packet containing:

- Customer brief and direction.
- Free report and prior Hermes run ID.
- Approved terminology and audience constraints.
- Source/target capture manifest.
- Selected gbrain and Linkup evidence.
- Hard cap of two additional content surfaces, each represented by one source/target locale pair.

The paid demo proves that payment autonomously re-hires the agency. It does not rely on hidden process memory or a human clicking “resume.” Server-side payment reconciliation is the fallback for delayed webhook delivery and must use the same idempotent continuation mutation.

## 7. Hermes agency contract

Hermes is the only semantic orchestrator.

### Hermes owns

- Reading the AuditPacket.
- Deciding the audit plan.
- Selecting relevant gbrain and Linkup evidence.
- Selecting up to three specialist roles based on the captured page.
- Calling one flat parallel `delegate_task` batch.
- Reconciling disagreements.
- Checking meaning, native tone, terminology, CTA quality, evidence, and visual fit.
- Optionally requesting one bounded repair when a real failure occurs.
- Producing the final report and deciding whether it is publishable.

### Deterministic infrastructure owns

- URL and locale-pair eligibility.
- Browser acquisition and artifact persistence.
- Job claiming and event mirroring.
- Authentication, rate limits, timeouts, and idempotency.
- Mechanical report-schema and reference validation.
- Payment verification and state transitions.

### The relay must never

- Choose specialist roles.
- Rewrite or rank copy.
- Call child models directly.
- Decide semantic retries.
- Reconcile findings.
- Judge cultural quality.
- Synthesize the report.

### Parent-run procedure

1. The relay creates an audit in Convex and starts one Hermes parent Run with `session_id=auditId` through the dedicated `nativas` Hermes profile.
2. The parent loads the versioned `nativas-manager` skill and reads the bounded AuditPacket plus the repo-versioned specialist catalog.
3. The parent invokes capture once, retrieves one small gbrain packet, and makes at most one Linkup `standard` request.
4. The parent chooses up to three leaf specialists and issues one flat `delegate_task` batch. Each child receives only its selected specialist instructions and bounded shared evidence; it never receives the per-run parent capability required by operational MCP writes and does not crawl independently.
5. The parent reconciles their outputs and may issue one single-task repair only when its QA finds an actual failure.
6. The parent invokes `submit_report`. The tool may return mechanical validation errors; at most two corrected submissions are allowed, and only one report version may be accepted.

Delegation depth is one, child concurrency is at most three, and the build uses the same validated provider/model for parent and children unless a smoke test proves an override. The manager’s plan should differ when the captured site warrants different expertise; do not create performative roles solely to resemble a swarm.

## 8. Technical architecture

```text
Cloudflare Pages UI  ↔  Convex audits/events/reports/payments
                              ↕ outbound claim + event mirror
                       nativas-relay
                              ↕ loopback Runs API / SSE
                       Hermes gateway
                              ↕ Hermes-selected tools
        Browser Run + R2 · gbrain/PGLite · Linkup · report writer
```

| Component | Purpose | Explicit non-responsibility |
|---|---|---|
| **Hermes Agent** | Plan, retrieve, delegate, reconcile, evaluate, and publish | Hosting, payments, browser rendering, product-state database |
| **Thin local relay** | Claim Convex jobs, call loopback Runs API, mirror genuine events/results | Semantic orchestration or model calls outside Hermes |
| **Convex** | Reactive source of truth for audits, events, artifacts, reports, payments, and prompt/skill versions | Localization knowledge or agent planning |
| **Cloudflare Pages** | Public React/Vite application | Hermes runtime |
| **Cloudflare Browser Run** | Render and capture public locale pages | Search, semantic localization judgment, CAPTCHA bypass |
| **Cloudflare R2** | Immutable screenshots, rendered HTML/Markdown, accessibility data, exported reports | Operational state or retrieval logic |
| **gbrain + PGLite** | Project-isolated hybrid retrieval over reviewed localization records | Customer run state or raw unreviewed web corpus |
| **Linkup** | All live and corpus-preparation web search with cited results | Durable knowledge storage or page rendering |
| **Dodo Payments** | One-time checkout and signed payment events | Audit orchestration |

Hermes runs as one long-lived local process for the hackathon. Standard Cloudflare Workers and Convex functions do not host the Hermes Python runtime. Keep the Hermes API loopback-only behind the relay and authenticated with a strong bearer token.

## 9. Knowledge design

Create a new nativas.ai gbrain isolated from the user’s personal brain. Use PGLite and local stdio MCP so there is no public knowledge server or storage migration on the critical path.

The six-record seed contains three reviewed examples per direction:

1. Hero/value proposition.
2. Primary CTA.
3. Trust or risk-reduction language.

Every record implements the canonical [`GoldenRecordV1`](docs/contracts/golden-record.md) contract. The checked-in fixture is synthetic contract data only; the implementation lane replaces it with six provenance-linked, reviewed records before judging whenever time permits.

The corpus contains exactly six records. Hermes performs one bounded retrieval per audit, selects at most three relevant records, and passes only those records to its children. Embeddings are used only if configuration succeeds immediately; keyword/hybrid retrieval is an honest fallback. Every report cites resolvable record IDs.

Audit outputs are never automatically promoted into the golden set. They become candidate records with provenance, and future improvement occurs only after review. This prevents the knowledge base from compounding hallucinations or weak recommendations.

## 10. Linkup search policy

Linkup is the only search provider for this repository and product.

- Use one structured `standard` request in the live audit path.
- Ask for two or three comparable official examples, relevant headline/CTA/trust conventions, why each example is comparable, and source URLs.
- Apply a hard timeout and cache the evidence packet by market/category.
- Share the packet across all Hermes children.
- If Linkup times out, use only the pre-reviewed gbrain packet and label the report `liveMarketEvidence: unavailable`.
- Use Linkup—not Exa—for golden-set research, company discovery, and future GTM searches.
- Do not add Exa SDKs, API keys, MCPs, fallbacks, references, or runtime calls.

## 11. State and contracts

### State machine

Free and paid work are separate audit records. Payment state lives on the payment record; the completed free audit never changes identity into a paid audit.

```text
FREE audit: SUBMITTED → ELIGIBILITY_CHECK → FREE_RUNNING → FREE_REPORT
PAID child: PAID_QUEUED → PAID_RUNNING → PAID_REPORT
```

A verified `payment.succeeded` event links the unchanged `FREE_REPORT` audit to one newly created `PAID_QUEUED` child audit. The P0 build proves that child run starts automatically; completing `PAID_REPORT` is P1.

Typed outcomes use the canonical [`AuditError`](docs/contracts/runtime-api.md#typed-failures) codes and `TERMINAL | RETRYABLE | DEGRADABLE | CONFLICT` classes. In particular, `HERMES_START_FAILED` is retryable once only when the HTTP client proves the request was never dispatched; any timeout, reset, or lost response after possible dispatch becomes terminal `HERMES_START_UNCERTAIN` pending operator reconciliation.

Retry only explicitly safe, idempotent reads once, excluding Linkup's single-attempt live request. Writes must have stable idempotency keys. Never fabricate page content, a locale relationship, market evidence, child progress, or a paid continuation. Hermes session/log evidence is diagnostic only: Hermes 0.18.2 exposes no run-by-session lookup, and the absence of a session never authorizes another `POST /v1/runs`.

### Mechanical report gate

`submit_report` validates only:

- Schema version and required fields.
- Audit ID, direction, report version, and enums.
- Exactly three free findings.
- Page, artifact, evidence, and gbrain references resolve.
- Proposed copy matches the target language.
- Count and length caps.
- Idempotent uniqueness of `(auditId, reportVersion)`.

Semantic quality remains Hermes’ responsibility. Deterministic infrastructure must not silently rewrite or reject findings based on stylistic judgment.

## 12. Success criteria

The build is ready to demo only when every P0 gate passes.

| Gate | Pass condition |
|---|---|
| **Hermes viability (P0)** | A pinned Hermes installation passes `doctor`; one parent Run completes; its real events are observed; one flat two-or-three-child `delegate_task` completes with the production provider/model and no blocking approval |
| **Eligibility (P0)** | A prevalidated fixture resolves to one public source/target homepage pair; private destinations and ambiguous pairs are rejected with typed errors |
| **Capture (P0)** | Browser Run returns both screenshots and rendered evidence; bytes are stored in R2; Convex references contain hashes and resolve |
| **Knowledge (P0)** | All six golden records validate; Hermes retrieves at least one relevant record; every used `gbrainRef` resolves |
| **Market evidence (P0)** | At least one real Linkup `standard` query returns cited structured evidence within the bounded timeout before judging; after that smoke succeeds, an individual audit may truthfully use the documented gbrain-only degradation |
| **Agency (P0)** | One Hermes manager chooses site-relevant roles, invokes one real native delegation batch, reconciles the summaries, and calls `submit_report`; no app code performs semantic orchestration |
| **Free report (P0)** | Exactly three findings publish with paired screenshots, actionable copy, business impact, rationale, confidence, and valid citations |
| **Payment continuation (P0)** | A real Dodo test payment is verified; a duplicate event cannot create a duplicate job; exactly one new Hermes run starts automatically with explicit prior context |
| **Paid completion (P1)** | If time remains, one rehearsal completes a capped paid report covering no more than two additional content surfaces, each represented by one source/target locale pair |
| **Realtime recovery (P0)** | Refreshing the run screen reconstructs status from Convex and reconciles the Hermes run without fabricated events |
| **Repeatability (P1)** | Three prevalidated free runs complete with at least 85% hard-contract success; retain one run per direction if time permits |
| **Latency/cost (P1)** | Free report finishes within four minutes or under $0.50; measured values are recorded rather than estimated |
| **Sponsor proof (P1)** | Convex dashboard, live Linkup result, Browser Run/R2 artifacts, Dodo event, Cloudflare deployment, and Hermes trace are ready in separate demo tabs |

## 13. Test strategy

Tests target at least **90% of meaningful production-like behavioral surface**, not superficial line coverage. The critical path must cover:

- URL and SSRF allow/deny cases.
- Locale-pair detection success and ambiguity.
- Browser capture success, timeout, malformed output, and artifact integrity.
- Linkup structured-output success and timeout degradation.
- gbrain record validation, retrieval, and unresolved-reference rejection.
- Hermes run creation, event normalization, delegation evidence, terminal failure, stop, and refresh reconciliation.
- Report schema, language, reference integrity, exact finding count, and idempotency.
- Dodo signature verification, duplicate webhook, delayed reconciliation, and exactly-once paid-run creation.
- State-transition legality and retry boundaries.
- One true end-to-end free audit and one free-audit → verified-payment → automatic-paid-run-start rehearsal against a prevalidated public fixture.

Do not add shallow tests merely to inflate a percentage. A test must protect a real contract, failure mode, or user-visible behavior. Remove or update stale tests in the same change as the behavior they cover.

## 14. Judge demonstration

### Two-minute path

1. Submit a prevalidated homepage and direction.
2. Show the real Hermes run ID, manager plan, capture/retrieval activity, and genuine delegation call.
3. While the new run continues, open a report produced by the same live system during rehearsal and disclose that fact.
4. Show three cited findings alongside paired source/target screenshots.
5. Complete Dodo test checkout.
6. Show the verified event transition to `PAID_QUEUED` and a new context-linked Hermes run starting automatically.
7. Open proof tabs for Hermes, Convex, Linkup, Cloudflare/R2, and Dodo.

### Emergency 30-second path

Show the most recent real completed report, its Hermes trace and run ID, the stored R2 screenshots, the Convex event stream, and the Dodo event that created a second Hermes run. Never present a recording or fixture as a currently executing run.

## 15. 3.5-hour execution plan

| Time | Verified milestone and cut trigger |
|---|---|
| `T+0–25` | **Hermes viability gate:** install/pin, `doctor`, parent Run, Runs events, and real delegation. If this fails, stop all UI work and fix Hermes. There is no valid Hermes-free fallback. |
| `T+25–60` | Scaffold the UI, Convex schema, and relay. Gate: intake creates a real Hermes run and genuine events appear in the live screen. |
| `T+60–90` | Browser Run captures the prevalidated homepage pair into R2 with Convex metadata. Cut overlays immediately if snapshots are not already stable. |
| `T+90–110` | Import and validate six gbrain records; prove one retrieval; prove one Linkup `standard` result. Give embeddings at most five minutes before using keyword/hybrid fallback. |
| `T+110–145` | Implement the versioned Hermes skill, narrow tool allowlist, dynamic delegation, mechanical report gate, and three-finding report UI. Plugin telemetry and `report_progress` remain out of path. |
| `T+145–165` | Implement Dodo checkout, verified/idempotent event processing, reconciliation fallback, and automatic context-linked paid Run. |
| `T+165–170` | Deploy and freeze features. No new services, abstractions, UI polish systems, or architecture changes after this point. |
| `T+170–195` | Complete one free-audit → payment → paid-run-start rehearsal, repeat free audits, refresh during one active run, and capture sponsor dashboards/evidence. Complete the paid report only if every P0 gate already passes. |
| `T+195–210` | Fix only fixture, configuration, or P0 contract defects; stage the demo tabs and truthful backup. Cut any unfinished P1/stretch work. |

## 16. Final stop line

The project is complete for the buildathon when one prevalidated homepage locale pair produces a repeatable, screenshot-grounded, three-finding report through a visibly autonomous Hermes manager and genuine native delegation, using one Linkup search plus one six-record gbrain retrieval, with Convex realtime state, Cloudflare Browser Run/R2 evidence, real Dodo checkout, and an automatic paid Hermes continuation capped at two additional content surfaces, each represented by one source/target locale pair.

Anything that does not directly strengthen that sentence is secondary and must not delay it.

## 17. Reference documentation

- [Hermes Agent documentation](https://hermes-agent.nousresearch.com/docs/)
- [Hermes Runs API](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/)
- [Hermes delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation/)
- [Hermes skills](https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills)
- [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
- [Convex React client](https://docs.convex.dev/client/react)
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions)
- [Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/)
- [Cloudflare Browser Run snapshot](https://developers.cloudflare.com/browser-run/quick-actions/snapshot/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Linkup search documentation](https://docs.linkup.so/pages/documentation/endpoints/search/overview)
- [Linkup structured output](https://docs.linkup.so/pages/documentation/endpoints/search/structured-output)
- [Dodo Payments Convex component](https://docs.dodopayments.com/developer-resources/convex-component)
- [gbrain](https://github.com/garrytan/gbrain)
- [Hermes Buildathon Builder Handbook](https://growthx.club/docs/hermes-buildathon-builder-handbook?utm_source=luma)

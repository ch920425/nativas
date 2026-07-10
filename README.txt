navitas.ai
==========

The autonomous localization agency for Korean companies entering the US and US companies entering Korea.

THE PROBLEM

International websites often fail even when their translations are technically correct. Copy is translated without the current page, component, product journey, visual hierarchy, or destination-market context. Headlines feel generic, CTAs miss local buying conventions, terminology drifts, and credible companies can appear foreign or untrustworthy.

navitas.ai starts with the public website a company already has. Submit one localization-enabled homepage, choose KR to US or US to KR, and receive a visual, market-aware audit with prioritized copy recommendations, business rationale, and cited evidence.

WHY NAVITAS.AI

navitas.ai is not a translation widget. It operates like a compact autonomous agency:

- It sees the rendered source and target pages, not isolated strings.
- It grounds decisions in current market evidence and reviewed localization precedents.
- It selects specialist agents for the page, reconciles their work, and validates the final report.
- It keeps every recommendation connected to its visual, market, and knowledge sources.
- After payment, it automatically starts a deeper engagement without a human coordinator.

Over time, completed engagements produce provenance-linked candidate knowledge. Reviewed decisions can be promoted into the project knowledge base, making future work more consistent and context-aware without automatically learning from unverified output.

HOW IT WORKS

1. Submit a public homepage and localization direction.
2. navitas.ai verifies and captures the Korean and English surfaces.
3. Hermes Agent plans the audit, retrieves relevant evidence, delegates specialist work, reconciles it, and publishes the report.
4. The report pairs the real page visuals with three high-impact localization findings and improved copy.
5. A verified payment automatically launches a capped deeper audit using the customer context already gathered.

TECHNOLOGY

- Hermes Agent is the agency runtime: planning, tool use, delegation, critique, reconciliation, and report publication.
- Convex is the realtime product backend for audit state, live events, reports, and payment state.
- Cloudflare Pages hosts the application; Browser Run captures rendered websites; R2 stores immutable visual evidence.
- Linkup is the sole web-search provider for cited market and research evidence.
- gbrain provides project-specific hybrid retrieval over reviewed localization decisions and anti-patterns.
- Dodo Payments provides checkout and verified, idempotent payment events that trigger paid Hermes engagements.

BUILDATHON SCOPE

The initial end-to-end product audits one public homepage locale pair, returns three evidence-backed findings, and demonstrates automatic paid continuation for at most two additional content surfaces, each represented by one source/target locale pair. The narrow scope is intentional: reliability, truthful agency behavior, and a complete customer outcome matter more than a broad but fragile crawl.

See PRD.md for the product contract and AGENTS.md for repository execution rules.

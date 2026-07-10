# Hermes specification assets

This directory is a checked-in runtime specification and implementation handoff. It does not contain the nativas.ai relay, MCP server, or product code.

## Runtime shape

nativas.ai runs one dedicated Hermes profile named `nativas` and one parent manager for each audit. The manager owns the customer-facing job and uses one native `delegate_task` batch containing two or three flat `leaf` specialists:

1. `nativas-visual-context` diagnoses hierarchy, component role, and visual-fit problems.
2. `nativas-market-copy` proposes market-native value proposition and CTA language from supplied evidence.
3. `nativas-evidence-qa` challenges meaning drift, unsupported claims, and broken references.

The manager alone captures pages, requests live market research, selects knowledge-base evidence, reconciles specialist results, and submits the report. It publishes exactly three findings for the free audit.

Hermes 0.18.2 does not expose a per-child toolset field in the model-facing `delegate_task` schema. Children therefore inherit the parent's allowlisted `nativas_kb` and `nativas_ops` toolsets. The product enforces the parent-only write boundary with an unguessable, run-scoped `parentCapability`:

- The relay creates and binds the capability to one `auditId` and Hermes `runId`.
- Only the parent AuditPacket contains the plaintext capability.
- Child context must never contain, quote, summarize, or request it.
- Every `nativas_ops` call requires it; the MCP server rejects missing, wrong, expired, or cross-run capabilities.
- The gbrain MCP is independently restricted to `search`, `query`, and `get_page`.

This is a defense-in-depth authorization boundary, not a prompt convention. A required integration test proves a child cannot call any `nativas_ops` tool.

## Files

- [`config.example.yaml`](config.example.yaml) is the safe Hermes profile shape. It contains paths and placeholders only.
- [`skills/manifest.json`](skills/manifest.json) versions the manager and specialist instructions.
- [`skills/nativas-manager/SKILL.md`](skills/nativas-manager/SKILL.md) defines the parent workflow.
- The three specialist skills define bounded leaf-agent judgments and a shared `SpecialistResultV1` response.
- [`../docs/hermes/local-runtime.md`](../docs/hermes/local-runtime.md) is the backend-lane setup and test handoff.
- [`../docs/hermes/discord-operations.md`](../docs/hermes/discord-operations.md) scopes a later, optional Discord observer.

At run creation, the relay reads the manifest, hashes the referenced skill files, persists those versions in the audit record, and supplies the manager instructions plus the bounded specialist catalog in `AuditPacketV1`. The manager copies only the selected specialist's exact instructions and relevant evidence into each child context.

## Explicit non-goals

- No three-profile Kanban or persistent swarm for customer audits.
- No Discord dependency in the customer workflow.
- No child orchestrators, recursive delegation, or human approval.
- No generic Hermes web search, Exa, mutable KB access, or unbounded crawling.
- No raw chain-of-thought or unfiltered page content in progress events.

Run `scripts/validate-hermes-spec.sh` from the repository root to validate these specification assets.

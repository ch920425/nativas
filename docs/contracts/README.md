# Contract catalog

Contract version `1.0` is the shared boundary for all three implementation lanes. These documents are normative; examples are illustrative unless a field is marked required.

| Contract | Contents |
|---|---|
| [Domain model](domain-model.md) | Audit state machine, Convex tables, indexes, public/internal functions |
| [Runtime API](runtime-api.md) | AuditPacket, events, relay/Worker boundaries, MCP tools, typed failures |
| [Evidence and report](report-and-evidence.md) | Capture manifest, artifacts, evidence pack, report schema and publication gates |
| [Payment continuation](payment-continuation.md) | Dodo checkout/webhook, idempotency, paid AuditPacket |
| [Fixtures](fixtures.md) | Canonical mock/fixture inventory and ownership |

## Freeze rules

1. Lane 2 implements these contracts in `packages/contracts` with runtime validation and exports generated/static TypeScript types from that one package.
2. Lanes 1 and 3 import or emit data against `packages/contracts`; neither creates shadow contract types.
3. Additive optional fields require a minor version. Removed/renamed/type-changed fields require a major version and coordinated migration.
4. State transitions, enum members, idempotency keys, and required fields are never changed silently.
5. Every contract change includes updated canonical fixtures plus validator, producer, and consumer tests.
6. Customer-visible schemas never expose chain-of-thought, secrets, raw tool payloads, or unbounded page content.

## Shared identifiers

- Public IDs are opaque, URL-safe UUIDs or ULIDs generated server-side.
- Convex internal `_id` values never cross MCP or public HTTP boundaries.
- Timestamps are UTC ISO 8601 strings at external boundaries and Convex numeric timestamps internally.
- `schemaVersion` is the string `1.0` in all v1 payloads.
- Monetary values use integer minor units and explicit ISO currency.
- Idempotency keys are deterministic strings described by each contract; they are not random retry tokens.

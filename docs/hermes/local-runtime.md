# Local Hermes runtime handoff

This document specifies the backend lane's local Hermes setup and verification. It is not product implementation code.

## Decision

Run the hackathon critical path on a dedicated local Hermes profile named `navitas`. Use one parent manager per audit plus a single native batch of two or three flat leaf children. Hermes Cloud is optional after the P0 demo; Discord is not a runtime dependency.

The browser never connects to Hermes. A thin backend relay calls the loopback Runs API, normalizes safe events into Convex, and leaves all semantic planning and localization judgment to Hermes.

## Profile setup

Verified target: Hermes CLI `0.18.2 (2026.7.7.2)`.

```bash
hermes --version
hermes doctor
hermes profile list
hermes profile create navitas --no-skills \
  --description "navitas.ai isolated localization agency runtime"
```

Creating the profile must not mutate the user's personal/default Hermes home. Apply `hermes/config.example.yaml` to the generated profile using local absolute paths. Keep all provider credentials, `API_SERVER_KEY`, and service tokens outside git.

The profile may use an already authenticated supported model provider. Nous Portal login is optional when another provider already passes `hermes doctor`.

## Skill packaging and provenance

The repository files remain canonical. At each run start, the relay:

1. Reads `hermes/skills/manifest.json`.
2. Resolves every path within the repository and rejects traversal or a missing file.
3. Computes SHA-256 over the exact bytes of the manager and specialist skills.
4. Persists IDs, semantic versions, hashes, Hermes version, prompt version, and KB version with the audit.
5. Places the manager instructions in `POST /v1/runs.instructions`.
6. Places the bounded specialist catalog, including exact instructions and hashes, in `AuditPacketV1`.

Hermes loads no mutable skill text from Discord, a customer page, or live search.

## Safe tool configuration

`platform_toolsets.api_server` must contain only:

- `delegation`
- `navitas_kb`
- `navitas_ops`

The KB MCP exposes only `search`, `query`, and `get_page`. The ops MCP exposes only `capture_site`, `search_market_evidence`, and `submit_report`. Generic shell, browser, web, file-write, mutable gbrain, and unrelated MCP toolsets are excluded from the API server.

The expected Hermes wire names are:

- `mcp_navitas_kb_search`
- `mcp_navitas_kb_query`
- `mcp_navitas_kb_get_page`
- `mcp_navitas_ops_capture_site`
- `mcp_navitas_ops_search_market_evidence`
- `mcp_navitas_ops_submit_report`

At process startup, compare `/v1/toolsets` and `/v1/capabilities` with this allowlist. Refuse audit claims when a required tool is absent or an unexpected tool/toolset is exposed.

## Parent-only capability

Hermes 0.18.2's model-facing `delegate_task` input supports `goal`, `context`, and `role`, but not per-child toolsets. Native children inherit the parent's exposed MCP toolsets. Therefore every `navitas_ops` input schema includes a required `parentCapability`.

The relay generates at least 128 bits of cryptographically random data, stores only a hash, and binds it to `auditId`, `runId`, purpose `NAVITAS_PARENT_OPS`, and expiry. The plaintext value appears only in the parent AuditPacket. The MCP server compares the hash in constant time and rejects a missing, invalid, expired, reused-across-run, or cross-audit capability before any side effect.

Child packets never contain the capability or the full parent packet. A child seeing an ops tool name is expected and harmless only when the server-side authorization test passes.

Required proof:

1. Parent can call each ops tool with the correct capability.
2. Child without the capability gets a typed authorization denial and causes no capture, search, or report write.
3. A capability for another run/audit is denied.
4. An expired capability is denied.
5. Logs and Convex events redact the plaintext capability.

## Runs API

Bind only to loopback and require bearer authentication:

```text
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=<provided-outside-git>
```

Start and inspect:

```bash
navitas gateway run
curl -fsS http://127.0.0.1:8642/health
curl -fsS http://127.0.0.1:8642/v1/capabilities \
  -H "Authorization: Bearer $API_SERVER_KEY"
curl -fsS http://127.0.0.1:8642/v1/toolsets \
  -H "Authorization: Bearer $API_SERVER_KEY"
```

The relay uses:

- `POST /v1/runs`
- `GET /v1/runs/{runId}`
- `GET /v1/runs/{runId}/events`
- `POST /v1/runs/{runId}/stop`

`session_id` equals the public `auditId`. The browser receives neither the API key nor direct loopback access.

## Create-before-bind safety

The Runs API generates the run ID and has no create idempotency key or reliable run-by-session recovery endpoint. The relay must use this fail-closed sequence:

1. Atomically reserve one start attempt in Convex before `POST /v1/runs`.
2. Record dispatch state as `RESERVED`, `NOT_DISPATCHED`, `MAYBE_DISPATCHED`, or `ACKNOWLEDGED`.
3. Retry only when transport evidence proves the request was never dispatched, such as connection refusal before request bytes were written.
4. Treat timeout, connection reset, process crash, or lost response after possible dispatch as `HERMES_START_UNCERTAIN`. Do not automatically create another run.
5. On HTTP 202, atomically bind the returned run ID to the reservation and mark it `ACKNOWLEDGED`.
6. A stale-start sweeper may claim abandoned reservations, but it may only retry `NOT_DISPATCHED`; every `MAYBE_DISPATCHED` reservation fails closed for operator reconciliation.

Hermes session/log evidence is diagnostic only. Session absence does not prove no run was created and never authorizes a retry.

## Delegation and report gates

- `max_concurrent_children: 3`
- `max_spawn_depth: 1`
- `orchestrator_enabled: false`
- `subagent_auto_approve: false`
- `inherit_mcp_toolsets: false` for nested orchestrator behavior; the MCP capability remains the real child boundary
- One initial two-or-three-task batch; every role is `leaf`
- One optional single-child repair only when the product contract permits it
- Manager alone merges results and calls `submit_report`
- Free report contains exactly three valid findings

No Convex function or relay code chooses a specialist, writes localization copy, or synthesizes a finding.

## Event auditing

Mirror native lifecycle, tool, and delegation events only. Ignore `reasoning.available` and never persist private reasoning. `RUN_CREATED` and `RUN_STARTED` are relay-derived state events.

Native SSE has no replay cursor. On reconnect, restore persisted Convex events and poll current/terminal run state; never fabricate missed intermediate child or tool activity. Event IDs are deterministic hashes of canonical raw events; relay events use the audit state revision.

The browser's live screen is the operator-visible audit surface. A complete trace proves which skill hashes, tools, children, evidence references, and accepted report belonged to the run.

## P0 verification checklist

```bash
scripts/validate-hermes-spec.sh
hermes doctor
navitas mcp test navitas_kb
navitas mcp test navitas_ops
```

Then prove with a real fixture audit:

- parent run starts and can use the three ops tools;
- one native batch starts two or three leaf children;
- child ops call is denied server-side;
- all child results conform to `SpecialistResultV1`;
- manager submits exactly three evidence-grounded findings;
- Convex live events contain no capability, page body, secret, or private reasoning;
- a maybe-dispatched create becomes `HERMES_START_UNCERTAIN` without a second run.

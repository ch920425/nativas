# Optional Discord operations observer

Discord is a post-P0 operator surface, not part of the customer workflow and not required for hackathon qualification. The navitas.ai website plus Convex remain the source of truth for audit status, artifacts, payments, reports, and recovery.

## Intended role

A later bot may mirror sanitized Convex events into a private operator server so the founder can watch the agency run from another device. It may also expose authenticated read-only status commands and a bounded stop command. It must not host the Hermes parent, carry customer prompts, store capabilities, or approve routine work.

Recommended private channels:

- `#navitas-runs`: one start and terminal summary per audit.
- `#navitas-alerts`: typed failures, uncertain starts, invalid webhooks, or contract rejection.
- `#navitas-metrics`: daily aggregate counts after the demo, with no page content.

Thread per audit only when volume justifies it. Use a truncated public audit reference, never raw URLs when they may contain sensitive query data.

## Allowed messages

- Safe audit ID, direction, current canonical state, elapsed time, and report/payment link.
- The same ≤160-character safe labels already persisted for the website live-run screen.
- Specialist IDs and lifecycle states, but no hidden reasoning or raw child context.
- Typed error code and an operator-safe remediation link.

## Prohibited messages

- `parentCapability`, Runs API key, Discord token, provider key, webhook secret, or signed artifact URL.
- Raw page HTML/Markdown, screenshots, full customer URL/query string, prompts, chain-of-thought, or unfiltered tool output.
- Payment method or customer-identifying data.
- A command that changes localization content or manually approves a normal audit step.

## Later setup gate

When P0 is complete, create a dedicated Discord application and private server, store the bot token only in the deployment secret store, grant minimum channel permissions, and bind command authorization to an explicit operator allowlist. A Discord bot token may be attached to only the intended observer integration; do not reuse a personal Hermes/Discord gateway token.

Before enabling writes, test duplicate delivery, ordering, redaction, rate limits, restart recovery, unauthorized commands, and audit-link authorization. Discord downtime must never delay or fail a customer audit.

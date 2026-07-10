# Three-lane integration plan

## Contract-first sequence

Lane 2 is the named integration lead. It publishes `packages/contracts`, root workspace configuration, and canonical fixtures first. All lanes acknowledge v1; Lane 2 alone owns root config, shared deployment files, and lockfiles after dispatch.

Checkpoints: T+60 frontend renders fixtures, backend mirrors a real Hermes event, and KB imports six records; T+90 one locale pair captures and one KB query resolves; T+125 one live three-finding report publishes; T+155 payment creates one paid run; feature freeze T+170.

## Merge order

1. Contracts/fixtures.
2. Knowledge lane after import/retrieval gate.
3. Backend free-run foundation.
4. Frontend rebased onto contracts/backend; production fixture transport removed.
5. Payment continuation, deployment, and full P0 E2E through exactly-one paid-run start. Paid-report completion follows only if all P0 gates pass.

Before merge: rebase, run owned tests, inspect paths, remove dead helpers/fixtures, and attach the handoff. Contract changes require schema, fixture, producer, consumer, and tests in one coordinated change. Lanes never edit another lane's paths; consumers do not work around malformed producer data. After freeze, merge only P0 config, security, or regression fixes.

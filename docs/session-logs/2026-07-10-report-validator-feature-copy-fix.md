# Report validator feature-copy recovery

## Incident

Fresh audits for `https://speak.com` and `https://agenticpiper.com` completed capture, evidence gathering, and Hermes execution, but ended at `REPORT_INVALID`. The third Hermes finding used `FEATURE_COPY` with an omitted KB reference. The validator only allowed a `VALUE_PROPOSITION` precedent for that component; the KR-to-US golden set did not contain one, so safe recovery had no eligible citation.

## Fix

`FEATURE_COPY` now selects an existing reviewed `VALUE_PROPOSITION` precedent first and an existing reviewed `HERO_HEADLINE` precedent second. This is a constrained component-family fallback, not invented provenance. A regression test covers a golden set with no value-proposition precedent.

## Verification

- Targeted local service tests: 8 passing.
- Typecheck: passing.
- Fresh Speak audit `aud_local_e1e4cb6eca7c43f7`: `FREE_REPORT`, three findings.
- Fresh AgenticPiper `.com` audit `aud_local_8bcd9ca4661f4528`: `FREE_REPORT`, three findings.
- `agenticpiper.net` independently fails DNS resolution (`ENOTFOUND`) and is correctly reported as an invalid public hostname rather than a report-validation failure.

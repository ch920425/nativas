# Hackathon submission handoff

## Product positioning supplied

- Project name: **Nativas AI**.
- Core proposition: an autonomous localization agency for Korea-to-US and US-to-Korea website launches.
- Demo instruction: submit `https://speak.com`, choose KR to US, watch Hermes coordinate the live audit, then open the report.
- Approved integration chips: Convex, Cloudflare, Wispr Flow, Linkup, Dodo Payments, React, TypeScript, and Node.js.

## Accuracy guardrails

- Use the deployed public `https://nativas.ai` URL in the submission, never localhost.
- Do not claim a live Dodo payment integration: the current local checkout is a demo simulation pending hosted checkout and verified webhook wiring.
- Do not list ElevenLabs; it is intentionally out of scope.

## Audit incident status

The `FEATURE_COPY` KB-reference recovery fix was committed as `4d3e070`. Fresh audits for Speak and AgenticPiper `.com` reach `FREE_REPORT` with three findings. AgenticPiper `.net` fails DNS resolution before audit execution.

# Cloudflare live deployment

## Deployment

- Cloudflare zone `nativas.ai` was active.
- Worker `nativas` was deployed with static React assets and custom domains `nativas.ai` and `www.nativas.ai`.
- The Worker secret `EDGE_ORIGIN_TOKEN` is stored in the macOS Keychain and injected only between Worker and laptop API. No secret was committed.
- The laptop API is running with the matching `NATIVAS_EDGE_TOKEN`.
- A Cloudflare Quick Tunnel is the temporary origin bridge because the current API token lacks `Account > Cloudflare Tunnel > Edit`; replace it with a named `api.nativas.ai` tunnel once that permission is available.

## External verification

- Worker URL: `https://nativas.chaseungjae.workers.dev`.
- `GET /` returned the deployed application.
- `GET /health` returned the native Hermes runtime status.
- A public `https://speak.com` KR-to-US submission completed through the Worker and tunnel as `FREE_REPORT` with three findings: `aud_local_8ac15f98d9b4487e`.

## DNS status at deployment

The custom domains were accepted by Worker deployment. Immediate resolver checks still returned no record because the domain registration was only minutes old; use the Worker URL while `nativas.ai` DNS propagates, then recheck the custom domain.

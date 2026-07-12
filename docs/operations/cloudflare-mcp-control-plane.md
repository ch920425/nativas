# Cloudflare MCP control plane

Nativas uses Cloudflare's official MCP servers for production control: Workers deployment, secrets, custom domains, tunnel administration, docs, builds, and observability. The browser and the local Node/Hermes backend do not receive a Cloudflare API token or OAuth credential.

## Credential boundary

| Surface | Credential | Storage |
| --- | --- | --- |
| Codex production operator | Cloudflare MCP OAuth | Codex-managed OAuth store |
| Cloudflare Worker | `EDGE_ORIGIN_TOKEN` | Worker secret |
| Laptop API | `NATIVAS_EDGE_TOKEN` | macOS Keychain/environment at launch |
| Capture caller + Worker | `NATIVAS_CAPTURE_ORIGIN_SECRET` / `CAPTURE_ORIGIN_SECRET` | macOS Keychain + matching Worker secret |
| Screenshot delivery | `ARTIFACT_DELIVERY_SECRET` | Worker secret only |
| Named tunnel connector | `CLOUDFLARE_TUNNEL_TOKEN` | macOS Keychain/environment at launch |

The laptop values are runtime connector credentials, not Cloudflare control-plane credentials. Rotate any affected value after compromise; never commit them, pass them to the client, or add them to a launchd plist.

## Operator workflow

1. Use the `cloudflare` MCP to deploy the Worker and configure the `nativas.ai` and `www.nativas.ai` custom domains.
2. Use the Cloudflare connectivity surface to create the named `api.nativas.ai` tunnel and public hostname, pointing to `http://127.0.0.1:8787`.
3. Enable private R2 bucket `nativas-audit-artifacts` with public access disabled.
4. Set Worker `API_ORIGIN`, `EDGE_ORIGIN_TOKEN`, `CAPTURE_ORIGIN_SECRET`, and `ARTIFACT_DELIVERY_SECRET` through the authenticated control plane.
5. Start the protected laptop origin and named connector with `scripts/cloudflare/run-origin.sh` and `scripts/cloudflare/run-tunnel.sh`.
6. Use Cloudflare observability to inspect typed Worker errors and confirm `https://nativas.ai/health` before demoing.

MCP is an operator tool, not an application dependency. It must not be called by the live request path or stored in the repository.

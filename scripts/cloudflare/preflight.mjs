import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";

const required = ["wrangler.jsonc", "cloudflare/worker.mjs", "apps/web/dist/index.html"];
for (const file of required) {
  const path = resolve(file);
  await access(path);
  if (file.endsWith("/")) await stat(path);
}

console.log("PASS Cloudflare deployment files and production web build are present.");
console.log("NEXT set API_ORIGIN and EDGE_ORIGIN_TOKEN as Worker secrets, then deploy after the Cloudflare zone is active.");

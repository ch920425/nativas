import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const required = ["wrangler.jsonc", "cloudflare/worker.mjs", "apps/web/dist/index.html"];
for (const file of required) {
  const path = resolve(file);
  await access(path);
  if (file.endsWith("/")) await stat(path);
}

const wrangler = JSON.parse((await readFile(resolve("wrangler.jsonc"), "utf8")).replace(/^\s*\/\/.*$/gm, ""));
if (wrangler.browser?.binding !== "BROWSER") throw new Error("Cloudflare Browser Run binding BROWSER is required");
if (!wrangler.r2_buckets?.some((binding) => binding.binding === "AUDIT_ARTIFACTS" && binding.bucket_name === "nativas-audit-artifacts")) {
  throw new Error("Private R2 binding AUDIT_ARTIFACTS is required");
}

console.log("PASS Cloudflare deployment files, production web build, Browser binding, and private R2 binding are present.");
console.log("NEXT verify production Worker secrets and run the protected live smoke before claiming release completion.");

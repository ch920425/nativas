import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const REQUIRED_CAPTURE_KINDS = ["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"] as const;

export function assertSafeCaptureUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("INVALID_URL");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("UNSAFE_URL");
  if (isUnsafeHostname(url.hostname)) throw new Error("UNSAFE_URL");
  return url;
}

export function isUnsafeHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") return true;
  return isIP(host) !== 0 && isPrivateAddress(host);
}

export function isPrivateAddress(address: string): boolean {
  if (address.includes(':')) {
    const normalized = address.toLowerCase();
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.');
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
}

export async function assertPublicResolution(url: URL, resolve: (hostname: string) => Promise<string[]>): Promise<string[]> {
  const addresses = await resolve(url.hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error("UNSAFE_URL");
  return addresses;
}

export function assertSameSiteCandidate(rawUrl: string, registrableDomain: string): URL {
  const url = assertSafeCaptureUrl(rawUrl);
  const host = url.hostname.toLowerCase();
  const boundary = registrableDomain.toLowerCase();
  if (host !== boundary && !host.endsWith(`.${boundary}`)) throw new Error("LOCALE_NOT_FOUND");
  return url;
}

export function assertCompleteCapture(kinds: readonly string[]): void {
  const present = new Set(kinds);
  if (REQUIRED_CAPTURE_KINDS.some((kind) => !present.has(kind))) throw new Error("CAPTURE_INCOMPLETE");
}

export type LinkupPacket =
  | { status: "AVAILABLE"; sources: Array<{ id: string; url: string; title: string }> }
  | { status: "UNAVAILABLE"; code: "RESEARCH_UNAVAILABLE" };

export async function searchLinkupOnce(client: { search(input: { query: string; depth: "standard"; maxResults: 3; timeoutMs: 12000 }): Promise<unknown> }, query: string): Promise<LinkupPacket> {
  try {
    const result = await client.search({ query, depth: "standard", maxResults: 3, timeoutMs: 12000 }) as { sources?: unknown };
    if (!Array.isArray(result.sources) || result.sources.length === 0 || result.sources.length > 3) throw new Error("malformed");
    const sources = result.sources.map((source) => {
      const item = source as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.url !== "string" || typeof item.title !== "string") throw new Error("malformed");
      const url = assertSafeCaptureUrl(item.url);
      if (url.protocol !== "https:") throw new Error("malformed");
      return { id: item.id, url: item.url, title: item.title };
    });
    return { status: "AVAILABLE", sources };
  } catch {
    return { status: "UNAVAILABLE", code: "RESEARCH_UNAVAILABLE" };
  }
}

export function verifyDodoWebhook<T>(client: { unwrap(body: string, options: { headers: Record<string, string> }): T }, rawBody: string, headers: Record<string, string | undefined>): T {
  const required = ["webhook-id", "webhook-signature", "webhook-timestamp"] as const;
  if (required.some((name) => !headers[name])) throw new Error("WEBHOOK_INVALID");
  try {
    return client.unwrap(rawBody, { headers: Object.fromEntries(required.map((name) => [name, headers[name]!])) });
  } catch {
    throw new Error("WEBHOOK_INVALID");
  }
}

export function hashCapability(capability: string): string {
  return createHash("sha256").update(capability).digest("hex");
}

export function capabilityMatches(expectedHash: string, capability: string): boolean {
  const actual = Buffer.from(hashCapability(capability));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

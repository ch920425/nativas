export type UrlValidation = { ok: true; url: URL } | { ok: false; reason: string };

const BLOCKED_HOST_PATTERNS: Array<(host: string) => boolean> = [
  (h) => h === "localhost" || h.endsWith(".localhost"),
  (h) => h.endsWith(".local") || h.endsWith(".internal"),
  (h) => h === "0.0.0.0" || h === "[::1]" || h === "::1",
  (h) => /^127\./.test(h),
  (h) => /^10\./.test(h),
  (h) => /^192\.168\./.test(h),
  (h) => /^172\.(1[6-9]|2\d|3[01])\./.test(h),
  (h) => /^169\.254\./.test(h), // link-local / cloud metadata
];

/**
 * Client-side pre-flight only. The backend URL/SSRF policy is authoritative;
 * this exists to give an honest, immediate error for obviously out-of-scope input.
 */
export function validatePublicHttpUrl(raw: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Enter a complete URL, including https://." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only public http(s) websites are in scope." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with embedded credentials are out of scope." };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOST_PATTERNS.some((match) => match(host))) {
    return { ok: false, reason: "Private, loopback, and internal addresses are out of scope." };
  }
  if (!host.includes(".")) {
    return { ok: false, reason: "Enter a public website address, like https://example.com." };
  }
  return { ok: true, url };
}

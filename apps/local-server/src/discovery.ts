import { createHash } from "node:crypto";
import type { Direction, PagePair, PageRole } from "@nativas/contracts";
import { localesFor } from "@nativas/contracts";

export type DiscoveredLink = {
  href: string; text?: string; hreflang?: string; counterpartHref?: string;
  counterpartMethod?: PagePair["pairingMethod"]; inPrimaryNavigation?: boolean;
};

const excluded = /(?:^|\/)(?:login|log-in|signin|sign-in|account|signup|sign-up|cart|checkout|privacy|terms|legal|careers?|jobs?|press|news|blog|search)(?:\/|$)/i;
const rolePatterns: Array<[PageRole, RegExp, number]> = [
  ["PRICING", /\/(?:pricing|plans?)(?:\/|\s|$)/i, 100],
  ["PRODUCT", /\/(?:product|platform)(?:\/|\s|$)/i, 90],
  ["FEATURES", /\/(?:features?)(?:\/|\s|$)/i, 90],
  ["SOLUTION", /\/(?:solutions?)(?:\/|\s|$)/i, 80],
  ["USE_CASE", /\/(?:use-cases?|cases?)(?:\/|\s|$)/i, 80],
  ["CUSTOMER", /\/(?:customers?|stories|case-studies)(?:\/|\s|$)/i, 70],
  ["DOCUMENTATION", /\/(?:docs?|documentation|developers?)(?:\/|\s|$)/i, 60],
];

export function selectPaidPagePairs(input: {
  auditId: string; direction: Direction; homepageUrls: [string, string]; links: DiscoveredLink[]; verifiedHosts: string[];
}): PagePair[] {
  const homes = new Set(input.homepageUrls.map(canonicalUrl));
  const hosts = new Set(input.verifiedHosts.map((host) => host.toLowerCase()));
  const [sourceLocale, targetLocale] = localesFor(input.direction);
  const candidates: PagePair[] = [];
  const seen = new Set<string>();
  for (const link of input.links) {
    if (!link.counterpartHref || !link.counterpartMethod) continue;
    let source: URL; let target: URL;
    try { source = safePublicHttpUrl(link.href); target = safePublicHttpUrl(link.counterpartHref); } catch { continue; }
    if (!withinBoundary(source, hosts) || !withinBoundary(target, hosts)) continue;
    const sourceCanonical = canonicalUrl(source.href); const targetCanonical = canonicalUrl(target.href);
    if (sourceCanonical === targetCanonical || homes.has(sourceCanonical) || homes.has(targetCanonical) || excluded.test(source.pathname) || excluded.test(target.pathname)) continue;
    if (looksLikeAsset(source) || looksLikeAsset(target)) continue;
    const key = `${sourceCanonical}\n${targetCanonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [role, base] = classify(source.pathname, link.text ?? "");
    const depth = source.pathname.split("/").filter(Boolean).length;
    const score = base + (link.inPrimaryNavigation ? 10 : 0) + (depth <= 2 ? 5 : 0) - (depth >= 4 ? 20 : 0);
    candidates.push({
      pairId: `pair_${createHash("sha256").update(key).digest("hex").slice(0, 16)}`, auditId: input.auditId, role,
      sourceUrl: sourceCanonical, targetUrl: targetCanonical, sourceLocale, targetLocale,
      pairingMethod: link.counterpartMethod, pairingEvidence: `${link.counterpartMethod}:${link.hreflang ?? "explicit"}`, discoveryScore: score,
    });
  }
  candidates.sort((a, b) => b.discoveryScore - a.discoveryScore || a.sourceUrl.localeCompare(b.sourceUrl));
  const selected: PagePair[] = [];
  for (const candidate of candidates) {
    if (selected.length === 2) break;
    if (selected.length === 1 && selected[0].role === candidate.role && candidates.some((other) => other.role !== candidate.role && !selected.includes(other))) continue;
    selected.push(candidate);
  }
  return selected;
}

function classify(path: string, text: string): [PageRole, number] {
  const value = `${path} ${text}`;
  for (const [role, pattern, score] of rolePatterns) if (pattern.test(value)) return [role, score];
  return ["OTHER", 40];
}

function safePublicHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("UNSAFE_URL");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) throw new Error("UNSAFE_URL");
  return url;
}

function withinBoundary(url: URL, verifiedHosts: Set<string>) { return verifiedHosts.has(url.hostname.toLowerCase()); }

function canonicalUrl(raw: string) {
  const url = new URL(raw);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return url.href;
}

function looksLikeAsset(url: URL) { return /\.(?:pdf|zip|png|jpe?g|gif|webp|svg|mp4|mp3|mov|docx?|xlsx?)$/i.test(url.pathname); }

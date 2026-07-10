import { execFileSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { loadCorpus, retrieve } from "../../kb-mcp/src/retrieval.mjs";
import { assertPublicResolution, assertSafeCaptureUrl } from "../../runtime/src/adapters.ts";
import type { IntakeInput } from "../../web/src/lib/contracts.ts";
import type { CapturePacket, GoldenReference, MarketSource, PagePreview } from "./service.ts";

const maxHtmlBytes = 2_000_000;

export async function captureHomepagePair(rawUrl: string, direction: IntakeInput["direction"]): Promise<CapturePacket> {
  const submitted = assertSafeCaptureUrl(rawUrl);
  const initial = await fetchHtml(submitted);
  const alternates = alternateLocales(initial.html, initial.url);
  const sourceLanguage = direction === "KR_TO_US" ? "ko" : "en";
  const targetLanguage = direction === "KR_TO_US" ? "en" : "ko";
  const sourceUrl = alternates.get(sourceLanguage) ?? initial.url;
  const targetUrl = alternates.get(targetLanguage) ?? initial.url;
  const sourcePage = sourceUrl === initial.url ? initial : await fetchHtml(new URL(sourceUrl));
  const targetPage = targetUrl === initial.url ? initial : await fetchHtml(new URL(targetUrl));
  return { sourceUrl: sourcePage.url, targetUrl: targetPage.url, paired: sourcePage.url !== targetPage.url, source: extractPreview(sourcePage.html), target: extractPreview(targetPage.html) };
}

export async function searchMarketEvidence(input: IntakeInput): Promise<MarketSource[]> {
  const apiKey = process.env.LINKUP_API_KEY || readKeychain("codex.linkup.api_key");
  if (!apiKey) throw new Error("RESEARCH_UNAVAILABLE");
  const target = input.direction === "KR_TO_US" ? "US English" : "Korean";
  const response = await fetch("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ q: `Find current public evidence about ${target} B2B SaaS homepage value propositions, primary CTA conventions, and trust language for this audience: ${input.audience}. Return source URLs.`, depth: "standard", outputType: "searchResults" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("RESEARCH_UNAVAILABLE");
  const payload = await response.json() as { results?: Array<{ name?: string; url?: string; content?: string }> };
  return (payload.results ?? []).slice(0, 3).flatMap((item, index) => item.url && item.name ? [{ id: `market_${index + 1}`, url: item.url, title: item.name, content: (item.content ?? "").slice(0, 1200) }] : []);
}

export async function retrieveGoldenReferences(input: IntakeInput): Promise<GoldenReference[]> {
  const corpus = await loadCorpus();
  const ids = new Set<string>();
  const results: GoldenReference[] = [];
  const leadComponent = input.direction === "KR_TO_US" ? "HERO_HEADLINE" : "VALUE_PROPOSITION";
  for (const componentType of [leadComponent, "PRIMARY_CTA", "TRUST_COPY"] as const) {
    const packet = retrieve(corpus, { direction: input.direction, componentType, audience: input.audience, query: input.launchGoal, limit: 1 });
    for (const record of packet.results) {
      if (ids.has(record.id)) continue;
      if (typeof record.precedent !== "string" || typeof record.rationale !== "string") continue;
      ids.add(record.id);
      results.push({ id: record.id, componentType: record.componentType, precedent: record.precedent, rationale: record.rationale });
    }
  }
  return results;
}

async function fetchHtml(start: URL): Promise<{ url: string; html: string }> {
  let current = start;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertPublicResolution(current, async (hostname) => (await lookup(hostname, { all: true })).map((item) => item.address));
    const response = await fetch(current, { redirect: "manual", headers: { "user-agent": "nativas.ai-local-audit/0.1" }, signal: AbortSignal.timeout(12_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) throw new Error("CAPTURE_INCOMPLETE");
      current = assertSafeCaptureUrl(new URL(location, current).href);
      continue;
    }
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) throw new Error("CAPTURE_INCOMPLETE");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > maxHtmlBytes) throw new Error("CAPTURE_INCOMPLETE");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxHtmlBytes) throw new Error("CAPTURE_INCOMPLETE");
    return { url: current.href, html: new TextDecoder().decode(bytes) };
  }
  throw new Error("CAPTURE_INCOMPLETE");
}

function alternateLocales(html: string, base: string) {
  const result = new Map<string, string>();
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    if (!String(attrs.rel ?? "").toLowerCase().includes("alternate") || !attrs.hreflang || !attrs.href) continue;
    const language = attrs.hreflang.toLowerCase().split("-")[0];
    if (language === "ko" || language === "en") result.set(language, new URL(attrs.href, base).href);
  }
  return result;
}

function attributes(tag: string) {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = match[2];
  return result;
}

function extractPreview(html: string): PagePreview {
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const headline = textOf(clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || textOf(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || "Homepage headline not exposed in HTML";
  const supportingCopy = textOf(clean.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]) || "Supporting copy not exposed in HTML";
  const cta = textOf(clean.match(/<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/i)?.[1]) || "Primary CTA not exposed in HTML";
  const text = textOf(clean).slice(0, 6000);
  return { headline: headline.slice(0, 240), supportingCopy: supportingCopy.slice(0, 360), cta: cta.slice(0, 120), text };
}

function textOf(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}

function readKeychain(service: string) {
  try { return execFileSync("security", ["find-generic-password", "-a", process.env.USER ?? "", "-s", service, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
}

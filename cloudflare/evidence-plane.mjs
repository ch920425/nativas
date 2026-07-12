const CAPTURE_PATH = "/internal/captures";
const ARTIFACT_ROUTE = /^\/api\/audits\/([A-Za-z0-9_-]{1,96})\/artifacts\/([A-Za-z0-9_-]{1,96})$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/;
const MAX_REQUEST_BYTES = 16_384;
const MAX_CLOCK_SKEW_SECONDS = 300;
const MAX_PAGES = 4;
const MAX_REDIRECTS = 5;
const MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const FORMATS = ["content", "screenshot", "markdown", "accessibilityTree"];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const CAPTURE_KINDS = Object.freeze({
  content: { kind: "HTML", extension: "html", mimeType: "text/html; charset=utf-8", maxBytes: MAX_TEXT_BYTES },
  screenshot: { kind: "SCREENSHOT", extension: "png", mimeType: "image/png", maxBytes: MAX_SCREENSHOT_BYTES },
  markdown: { kind: "MARKDOWN", extension: "md", mimeType: "text/markdown; charset=utf-8", maxBytes: MAX_TEXT_BYTES },
  accessibilityTree: { kind: "ACCESSIBILITY_TREE", extension: "json", mimeType: "application/json", maxBytes: MAX_TEXT_BYTES },
});

function jsonError(error, status, requestId) {
  return Response.json({ error, requestId }, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

function requireBinding(env, name) {
  if (!env[name]) throw typedError("CAPTURE_NOT_CONFIGURED", 503);
  return env[name];
}

function typedError(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

function assertId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw typedError(`INVALID_${label.toUpperCase()}`);
  return value;
}

function normalizeDomain(value) {
  if (typeof value !== "string") throw typedError("INVALID_SITE_BOUNDARY");
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw typedError("INVALID_SITE_BOUNDARY");
  return domain;
}

function hostWithinBoundary(hostname, boundary) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === boundary || host.endsWith(`.${boundary}`);
}

export function assertSafePublicUrl(rawUrl, siteBoundary) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw typedError("UNSAFE_CAPTURE_URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw typedError("UNSAFE_CAPTURE_URL");
  if (url.toString().length > 512) throw typedError("UNSAFE_CAPTURE_URL");
  if (url.username || url.password || url.hash) throw typedError("UNSAFE_CAPTURE_URL");
  // URL normalizes default 80/443 ports to an empty string; any remaining explicit port is non-default.
  if (url.port) throw typedError("UNSAFE_CAPTURE_URL");
  if (isIpLiteral(url.hostname) || !hostWithinBoundary(url.hostname, siteBoundary)) throw typedError("UNSAFE_CAPTURE_URL");
  return url;
}

function isIpLiteral(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function ipv4Parts(value) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return undefined;
  return parts.map(Number);
}

export function isPublicAddress(address) {
  const v4 = ipv4Parts(address);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0) return false;
    return true;
  }
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (!normalized.includes(":")) return false;
  if (normalized === "::" || normalized === "::1") return false;
  if (/^(?:fc|fd)/.test(normalized) || /^fe[89ab]/.test(normalized) || /^ff/.test(normalized)) return false;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPublicAddress(mapped[1]) : !/^2001:db8(?::|$)/.test(normalized);
}

async function resolvePublic(hostname, fetcher = (...args) => fetch(...args)) {
  const endpoint = new URL("https://cloudflare-dns.com/dns-query");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", "A");
  const response = await fetcher(endpoint, { headers: { accept: "application/dns-json" } });
  if (!response.ok) throw typedError("DNS_VALIDATION_FAILED", 502);
  const payload = await response.json();
  const answers = (payload.Answer ?? []).map((answer) => answer.data).filter((value) => typeof value === "string" && (ipv4Parts(value) || value.includes(":")));
  if (answers.length === 0 || answers.some((address) => !isPublicAddress(address))) throw typedError("UNSAFE_CAPTURE_RESOLUTION");
  return answers;
}

async function preflightUrl(rawUrl, siteBoundary, dependencies) {
  let current = assertSafePublicUrl(rawUrl, siteBoundary);
  const redirects = [];
  for (let count = 0; count <= MAX_REDIRECTS; count += 1) {
    await dependencies.resolvePublic(current.hostname);
    const response = await dependencies.fetch(current, { method: "GET", redirect: "manual", headers: { range: "bytes=0-0", "user-agent": "nativas-evidence-capture/1.0" } });
    if (response.body) await response.body.cancel();
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.ok && response.status !== 206 && response.status !== 416) throw typedError("CAPTURE_PREFLIGHT_FAILED", 502);
      return { finalUrl: current.toString(), redirects };
    }
    const location = response.headers.get("location");
    if (!location || count === MAX_REDIRECTS) throw typedError("UNSAFE_CAPTURE_REDIRECT");
    current = assertSafePublicUrl(new URL(location, current).toString(), siteBoundary);
    redirects.push(current.toString());
  }
}

function bytesFromBase64(value) {
  if (typeof value !== "string" || value.length === 0) throw typedError("CAPTURE_INCOMPLETE", 502);
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < pngSignature.length || pngSignature.some((byte, index) => bytes[index] !== byte)) throw typedError("CAPTURE_INCOMPLETE", 502);
    return bytes;
  } catch {
    throw typedError("CAPTURE_INCOMPLETE", 502);
  }
}

function formatBytes(field, value) {
  if (field === "screenshot") return bytesFromBase64(value);
  if (field === "accessibilityTree") {
    if (!value || typeof value !== "object") throw typedError("CAPTURE_INCOMPLETE", 502);
    return encoder.encode(JSON.stringify(value));
  }
  if (typeof value !== "string" || value.length === 0) throw typedError("CAPTURE_INCOMPLETE", 502);
  return encoder.encode(value);
}

async function hashBytes(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseSignature(value) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return undefined;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function verifyHmac(secret, value, encodedSignature) {
  const signature = parseSignature(encodedSignature);
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(value));
}

async function readBoundedBody(request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES) throw typedError("CAPTURE_REQUEST_TOO_LARGE", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_REQUEST_BYTES) throw typedError("CAPTURE_REQUEST_TOO_LARGE", 413);
  return { bytes, text: decoder.decode(bytes) };
}

async function authenticateCapture(request, bodyText, env, nowSeconds) {
  const secret = requireBinding(env, "CAPTURE_ORIGIN_SECRET");
  const rawRequestId = request.headers.get("x-nativas-capture-request-id");
  if (!rawRequestId || !ID_PATTERN.test(rawRequestId)) throw typedError("CAPTURE_AUTH_FAILED", 401);
  const requestId = rawRequestId;
  const timestampText = request.headers.get("x-nativas-capture-timestamp") ?? "";
  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) throw typedError("CAPTURE_AUTH_FAILED", 401);
  const signedValue = `${timestampText}.${requestId}.${bodyText}`;
  if (!await verifyHmac(secret, signedValue, request.headers.get("x-nativas-capture-signature"))) throw typedError("CAPTURE_AUTH_FAILED", 401);
  const replayKey = `_internal/capture-replays/${requestId}`;
  const marker = await env.AUDIT_ARTIFACTS.put(replayKey, "accepted", {
    onlyIf: { etagDoesNotMatch: "*" },
    customMetadata: { expiresAt: String(nowSeconds + MAX_CLOCK_SKEW_SECONDS) },
  });
  if (!marker) throw typedError("CAPTURE_REPLAYED", 409);
  return requestId;
}

function validateCapturePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw typedError("INVALID_CAPTURE_REQUEST");
  const auditId = assertId(value.auditId, "audit_id");
  const siteBoundary = normalizeDomain(value.siteBoundary);
  if (!Array.isArray(value.pages) || value.pages.length === 0 || value.pages.length > MAX_PAGES) throw typedError("INVALID_CAPTURE_PAGES");
  const pages = value.pages.map((page) => {
    if (!page || typeof page !== "object") throw typedError("INVALID_CAPTURE_PAGE");
    const pairId = assertId(page.pairId, "pair_id");
    if (page.side !== "source" && page.side !== "target") throw typedError("INVALID_CAPTURE_SIDE");
    const url = assertSafePublicUrl(page.url, siteBoundary).toString();
    return { pairId, side: page.side, url };
  });
  const identities = new Set(pages.map((page) => `${page.pairId}:${page.side}`));
  if (identities.size !== pages.length) throw typedError("DUPLICATE_CAPTURE_PAGE");
  return { auditId, siteBoundary, pages };
}

async function snapshotPage(browser, finalUrl, sleep) {
  const options = {
    url: finalUrl,
    formats: FORMATS,
    viewport: { width: 1440, height: 900 },
    screenshotOptions: { fullPage: true, type: "png" },
    gotoOptions: { waitUntil: "domcontentloaded", timeout: 30_000 },
  };
  let response;
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Browser Rendering enforces per-minute browser limits; 429/5xx needs real backoff.
    const backoffMs = 2000 * (attempt + 1);
    try {
      response = await browser.quickAction("snapshot", options);
    } catch (error) {
      if (attempt < attempts - 1 && /timeout|429|rate|busy|limit/i.test(String(error))) { await sleep(backoffMs); continue; }
      console.error(JSON.stringify({ stage: "browser-snapshot", error: String(error?.message ?? error).slice(0, 300) }));
      throw typedError("BROWSER_CAPTURE_FAILED", 502);
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt < attempts - 1) { await response.body?.cancel(); await sleep(backoffMs); continue; }
      console.error(JSON.stringify({ stage: "browser-snapshot", status: response.status }));
      throw typedError("BROWSER_CAPTURE_FAILED", 502);
    }
    break;
  }
  if (!response.ok) throw typedError("BROWSER_CAPTURE_FAILED", 502);
  let payload;
  try { payload = await response.json(); } catch { throw typedError("CAPTURE_INCOMPLETE", 502); }
  const result = payload.result ?? payload;
  return { result, browserMsUsed: response.headers.get("x-browser-ms-used") ?? payload.meta?.browserMsUsed };
}

async function persistPage(bucket, capture, page, finalUrl, snapshot, capturedAt) {
  const descriptors = [];
  const writtenKeys = [];
  try {
    for (const field of FORMATS) {
      const config = CAPTURE_KINDS[field];
      const bytes = formatBytes(field, snapshot.result[field]);
      if (bytes.byteLength === 0 || bytes.byteLength > config.maxBytes) throw typedError("CAPTURE_INCOMPLETE", 502);
      const sha256 = await hashBytes(bytes);
      const identityHash = await hashBytes(encoder.encode(`${capture.auditId}:${page.pairId}:${page.side}:${config.kind}:${sha256}`));
      const artifactId = `art_${identityHash.slice(0, 32)}`;
      const r2Key = `audits/${capture.auditId}/pairs/${page.pairId}/${page.side}/${config.kind.toLowerCase()}-${sha256}.${config.extension}`;
      const descriptor = {
        artifactId, auditId: capture.auditId, pairId: page.pairId, side: page.side.toUpperCase(), kind: config.kind,
        r2Key, mimeType: config.mimeType, sha256, sizeBytes: bytes.byteLength, sourceUrl: page.url, finalUrl, capturedAt,
      };
      const customMetadata = {
        auditId: capture.auditId, pairId: page.pairId, side: page.side, artifactId, kind: config.kind,
        sourceUrl: page.url, finalUrl, capturedAt, sha256, sizeBytes: String(bytes.byteLength), browserMsUsed: String(snapshot.browserMsUsed ?? ""),
      };
      const stored = await bucket.put(r2Key, bytes, { httpMetadata: { contentType: config.mimeType }, customMetadata });
      if (!stored) throw typedError("ARTIFACT_STORAGE_FAILED", 502);
      writtenKeys.push(r2Key);
      const indexKey = `audits/${capture.auditId}/artifact-index/${artifactId}.json`;
      await bucket.put(indexKey, JSON.stringify(descriptor), { httpMetadata: { contentType: "application/json" }, customMetadata: { auditId: capture.auditId, artifactId, kind: config.kind } });
      writtenKeys.push(indexKey);
      descriptors.push(descriptor);
    }
    return { descriptors, writtenKeys };
  } catch (error) {
    if (writtenKeys.length) await bucket.delete(writtenKeys);
    if (error?.code) throw error;
    throw typedError("ARTIFACT_STORAGE_FAILED", 502);
  }
}

async function handleCapture(request, env, dependencies) {
  const bucket = requireBinding(env, "AUDIT_ARTIFACTS");
  requireBinding(env, "BROWSER");
  const { text: bodyText } = await readBoundedBody(request);
  const requestId = await authenticateCapture(request, bodyText, env, Math.floor(dependencies.now() / 1000));
  let raw;
  try { raw = JSON.parse(bodyText); } catch { throw typedError("INVALID_CAPTURE_REQUEST"); }
  const capture = validateCapturePayload(raw);
  const requestHash = await hashBytes(encoder.encode(bodyText));
  const manifestKey = `audits/${capture.auditId}/captures/v1.json`;
  const existing = await bucket.get(manifestKey);
  if (existing) {
    const manifest = await existing.json();
    if (manifest.requestHash !== requestHash) throw typedError("CAPTURE_CONFLICT", 409);
    return Response.json(manifest, { headers: { "cache-control": "no-store" } });
  }

  const capturedAt = new Date(dependencies.now()).toISOString();
  const artifacts = [];
  const writtenKeys = [];
  try {
    for (const page of capture.pages) {
      const preflight = await preflightUrl(page.url, capture.siteBoundary, dependencies);
      // Recheck immediately before Browser Run to narrow the rebinding window.
      await dependencies.resolvePublic(new URL(preflight.finalUrl).hostname);
      const snapshot = await snapshotPage(env.BROWSER, preflight.finalUrl, dependencies.sleep);
      const persisted = await persistPage(bucket, capture, page, preflight.finalUrl, snapshot, capturedAt);
      artifacts.push(...persisted.descriptors);
      writtenKeys.push(...persisted.writtenKeys);
    }
    const manifest = { captureId: `capture_${capture.auditId}_v1`, auditId: capture.auditId, requestId, requestHash, capturedAt, artifacts };
    const stored = await bucket.put(manifestKey, JSON.stringify(manifest), { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: "application/json" }, customMetadata: { auditId: capture.auditId, captureId: manifest.captureId } });
    if (!stored) throw typedError("CAPTURE_CONFLICT", 409);
    return Response.json(manifest, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (writtenKeys.length) await bucket.delete(writtenKeys);
    throw error;
  }
}

export async function createArtifactCapability(secret, auditId, artifactId, expiresAt) {
  assertId(auditId, "audit_id");
  assertId(artifactId, "artifact_id");
  if (!Number.isInteger(expiresAt)) throw typedError("INVALID_ARTIFACT_CAPABILITY");
  return `${expiresAt}.${base64Url(await hmac(secret, `${auditId}.${artifactId}.${expiresAt}`))}`;
}

export async function createCaptureSignature(secret, timestamp, requestId, bodyText) {
  assertId(requestId, "request_id");
  if (!Number.isInteger(timestamp) || typeof bodyText !== "string") throw typedError("INVALID_CAPTURE_SIGNATURE_INPUT");
  return base64Url(await hmac(secret, `${timestamp}.${requestId}.${bodyText}`));
}

async function authorizeArtifact(request, env, auditId, artifactId, nowSeconds) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const [expiresText, signature] = token.split(".");
  const expiresAt = Number(expiresText);
  if (!Number.isInteger(expiresAt) || expiresAt < nowSeconds || expiresAt > nowSeconds + 900) throw typedError("ARTIFACT_FORBIDDEN", 403);
  const deliverySecret = env.ARTIFACT_DELIVERY_SECRET;
  const originSecret = env.CAPTURE_ORIGIN_SECRET;
  if (!deliverySecret && !originSecret) throw typedError("CAPTURE_NOT_CONFIGURED", 503);
  const message = `${auditId}.${artifactId}.${expiresAt}`;
  const authorized =
    (deliverySecret ? await verifyHmac(deliverySecret, message, signature) : false) ||
    (originSecret ? await verifyHmac(originSecret, message, signature) : false);
  if (!authorized) throw typedError("ARTIFACT_FORBIDDEN", 403);
}

async function handleArtifact(request, env, auditId, artifactId, dependencies) {
  await authorizeArtifact(request, env, auditId, artifactId, Math.floor(dependencies.now() / 1000));
  const bucket = requireBinding(env, "AUDIT_ARTIFACTS");
  const index = await bucket.get(`audits/${auditId}/artifact-index/${artifactId}.json`);
  if (!index) throw typedError("ARTIFACT_NOT_FOUND", 404);
  const descriptor = await index.json();
  if (descriptor.auditId !== auditId || descriptor.artifactId !== artifactId || descriptor.kind !== "SCREENSHOT") throw typedError("ARTIFACT_FORBIDDEN", 403);
  const object = await bucket.get(descriptor.r2Key);
  if (!object) throw typedError("ARTIFACT_NOT_FOUND", 404);
  return new Response(object.body, {
    headers: {
      "content-type": "image/png",
      "content-length": String(object.size),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

export function createEvidencePlane(overrides = {}) {
  // Global fetch must stay attached to the global scope in workerd; a detached
  // reference (or one invoked as a method of another object) throws
  // "Illegal invocation", so wrap it in an arrow function.
  const safeFetch = overrides.fetch ?? ((...args) => fetch(...args));
  const dependencies = {
    now: overrides.now ?? Date.now,
    fetch: safeFetch,
    resolvePublic: overrides.resolvePublic ?? ((hostname) => resolvePublic(hostname, safeFetch)),
    sleep: overrides.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
  };
  return async function routeEvidence(request, env) {
    const url = new URL(request.url);
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      if (url.pathname === CAPTURE_PATH) {
        if (request.method !== "POST") return jsonError("METHOD_NOT_ALLOWED", 405, requestId);
        return await handleCapture(request, env, dependencies);
      }
      const artifactMatch = url.pathname.match(ARTIFACT_ROUTE);
      if (artifactMatch) {
        if (request.method !== "GET") return jsonError("METHOD_NOT_ALLOWED", 405, requestId);
        return await handleArtifact(request, env, artifactMatch[1], artifactMatch[2], dependencies);
      }
      return undefined;
    } catch (error) {
      const code = error?.code ?? "EVIDENCE_PLANE_FAILED";
      const status = error?.status ?? 500;
      const detail = code === "EVIDENCE_PLANE_FAILED" ? String(error?.message ?? error).slice(0, 300) : undefined;
      console.error(JSON.stringify({ requestId, route: url.pathname, stage: "evidence-plane", status, error: code, ...(detail ? { detail } : {}) }));
      return jsonError(code, status, requestId);
    }
  };
}

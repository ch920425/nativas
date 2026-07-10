import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const corpusUrl = new URL("../../../fixtures/kb/golden-six.v1.json", import.meta.url);
const requiredKeys = [
  "schemaVersion", "id", "version", "direction", "sourceLocale", "targetLocale",
  "industry", "audience", "pageType", "componentType", "category", "sourceCopy",
  "currentTargetCopy", "recommendedTargetCopy", "intent", "rationale", "visualConstraints",
  "patternType", "sourceUrls", "screenshotArtifactRef", "capturedAt", "reviewedAt",
  "reviewerStatus", "keywords"
];
const directions = new Map([
  ["KR_TO_US", ["ko-KR", "en-US"]],
  ["US_TO_KR", ["en-US", "ko-KR"]]
]);
const componentTypes = new Set(["HERO_HEADLINE", "VALUE_PROPOSITION", "PRIMARY_CTA", "TRUST_COPY"]);
const fallbackMode = "KEYWORD_DETERMINISTIC";

export const corpusPath = fileURLToPath(corpusUrl);

export async function loadCorpus() {
  const records = JSON.parse(await readFile(corpusUrl, "utf8"));
  validateCorpus(records);
  return records;
}

export function validateCorpus(records) {
  if (!Array.isArray(records) || records.length !== 6) throw new Error("golden-six-v1 must contain exactly six records");
  const ids = new Set();
  const byDirection = { KR_TO_US: 0, US_TO_KR: 0 };
  for (const record of records) {
    for (const key of requiredKeys) if (!(key in record)) throw new Error(`record ${record.id ?? "<unknown>"} missing ${key}`);
    if (record.schemaVersion !== "1.0" || record.version !== "golden-six-v1") throw new Error(`record ${record.id} has unsupported version`);
    if (ids.has(record.id)) throw new Error(`duplicate record id ${record.id}`);
    ids.add(record.id);
    const locales = directions.get(record.direction);
    if (!locales || record.sourceLocale !== locales[0] || record.targetLocale !== locales[1]) throw new Error(`record ${record.id} has invalid direction/locales`);
    if (!componentTypes.has(record.componentType)) throw new Error(`record ${record.id} has invalid component type`);
    if (record.pageType !== "HOMEPAGE" || !["PRECEDENT", "ANTI_PATTERN"].includes(record.patternType) || record.reviewerStatus !== "REVIEWED") throw new Error(`record ${record.id} has invalid enum`);
    if (!Array.isArray(record.sourceUrls) || record.sourceUrls.length < 1 || !record.sourceUrls.every((url) => isHttpUrl(url))) throw new Error(`record ${record.id} has invalid source URLs`);
    if (!isHttpUrl(record.screenshotArtifactRef)) throw new Error(`record ${record.id} has invalid screenshot reference`);
    if (!Array.isArray(record.keywords) || record.keywords.length === 0 || !Array.isArray(record.visualConstraints) || record.visualConstraints.length === 0) throw new Error(`record ${record.id} needs retrieval/visual evidence`);
    if (!isUtc(record.capturedAt) || !isUtc(record.reviewedAt)) throw new Error(`record ${record.id} has invalid UTC timestamps`);
    byDirection[record.direction] += 1;
  }
  if (byDirection.KR_TO_US !== 3 || byDirection.US_TO_KR !== 3) throw new Error("golden-six-v1 requires three records per direction");
  for (const direction of directions.keys()) {
    const components = new Set(records.filter((record) => record.direction === direction).map((record) => record.componentType));
    if (!["HERO_HEADLINE", "VALUE_PROPOSITION"].some((type) => components.has(type)) || !components.has("PRIMARY_CTA") || !components.has("TRUST_COPY")) {
      throw new Error(`record direction ${direction} must cover hero/value proposition, primary CTA, and trust language`);
    }
  }
  return true;
}

export function retrieve(records, request = {}) {
  const { direction, componentType, limit } = validateRetrievalRequest(request);
  const queryTerms = terms([request.query, request.industry, request.audience, request.issueHypothesis].filter(Boolean).join(" "));
  const ranked = records
    .filter((record) => record.direction === direction)
    .map((record) => ({ record, score: score(record, componentType, queryTerms) }))
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
    .slice(0, limit)
    .map(({ record, score }) => summarize(record, score));
  return { mode: fallbackMode, corpusVersion: "golden-six-v1", results: ranked };
}

export function getPage(records, id) {
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error(`unknown record ${id}`);
  return summarize(record, null);
}

export function corpusDigest(records) {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

export function validateRetrievalRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("retrieval request must be an object");
  const direction = request.direction;
  if (!directions.has(direction)) throw new Error("direction must be KR_TO_US or US_TO_KR");
  if (request.componentType !== undefined && !componentTypes.has(request.componentType)) throw new Error("componentType is invalid");
  for (const field of ["query", "industry", "audience", "issueHypothesis"]) if (request[field] !== undefined && typeof request[field] !== "string") throw new Error(`${field} must be a string`);
  if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit < 1)) throw new Error("limit must be a positive integer");
  const [sourceLocale, targetLocale] = directions.get(direction);
  if (request.sourceLocale !== undefined && request.sourceLocale !== sourceLocale) throw new Error("sourceLocale conflicts with direction");
  if (request.targetLocale !== undefined && request.targetLocale !== targetLocale) throw new Error("targetLocale conflicts with direction");
  return { direction, componentType: request.componentType, limit: Math.min(request.limit ?? 3, 3) };
}

function summarize(record, score) {
  return {
    id: record.id,
    title: `${record.direction} ${record.componentType}: ${record.category}`,
    direction: record.direction,
    sourceLocale: record.sourceLocale,
    targetLocale: record.targetLocale,
    componentType: record.componentType,
    patternType: record.patternType,
    precedent: record.recommendedTargetCopy,
    rationale: record.rationale,
    sourceUrl: record.sourceUrls[0],
    screenshotArtifactRef: record.screenshotArtifactRef,
    capturedAt: record.capturedAt,
    reviewedAt: record.reviewedAt,
    supportLabel: record.keywords.includes("DEMO_SEED") ? "DEMO_REFERENCE_MATERIAL" : "REVIEWED_REFERENCE_MATERIAL",
    ...(score === null ? {} : { score })
  };
}

function score(record, requestedComponent, queryTerms) {
  let total = record.componentType === requestedComponent ? 100 : 0;
  const haystack = terms([record.industry, record.audience, record.category, record.intent, record.rationale, ...record.keywords].join(" "));
  for (const term of queryTerms) if (haystack.has(term)) total += 10;
  return total;
}

function terms(value) {
  return new Set(String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").split(/\s+/).filter((term) => term.length > 1));
}

function isHttpUrl(value) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function isUtc(value) {
  return typeof value === "string" && value.endsWith("Z") && !Number.isNaN(Date.parse(value));
}

import { createHash, randomUUID } from "node:crypto";

export const KB_LIFECYCLE_STAGES = Object.freeze([
  "FREE_EVIDENCE_RETRIEVAL",
  "PAID_DISCOVERY_RETRIEVAL",
  "SPECIALIST_REFERENCE_RESOLUTION",
  "PARENT_RECONCILIATION"
]);

export function retrievalPlan(stage, input) {
  const direction = input?.direction;
  if (!['KR_TO_US', 'US_TO_KR'].includes(direction)) throw new Error('direction must be KR_TO_US or US_TO_KR');
  if (!KB_LIFECYCLE_STAGES.includes(stage)) throw new Error(`unsupported KB lifecycle stage ${stage}`);
  const common = { direction, sourceLocale: input.sourceLocale, targetLocale: input.targetLocale, audience: input.audience, industry: input.industry };
  if (stage === "FREE_EVIDENCE_RETRIEVAL") return [{ toolName: "search", arguments: { ...common, componentType: input.componentType, query: input.launchGoal, limit: 3 } }];
  if (stage === "PAID_DISCOVERY_RETRIEVAL") return [{ toolName: "query", arguments: { ...common, componentType: input.componentType, query: input.pageContext, issueHypothesis: input.issueHypothesis, limit: 3 } }];
  if (stage === "SPECIALIST_REFERENCE_RESOLUTION") {
    if (!input.recordId) throw new Error('recordId is required for specialist resolution');
    return [{ toolName: "get_page", arguments: { id: input.recordId } }];
  }
  if (!Array.isArray(input.recordIds) || input.recordIds.length < 1 || input.recordIds.length > 3) throw new Error('one to three selected recordIds are required for reconciliation');
  return [{ toolName: "think", arguments: { question: `${input.question}\nUse only these preselected record IDs: ${input.recordIds.join(', ')}`, anchor: input.recordIds[0], rounds: 1, save: false, take: false } }];
}

export function startRetrievalSpan({ auditId, hermesRunId, stage, toolName, arguments: args, kbVersion, now = () => new Date().toISOString(), id = randomUUID }) {
  if (!auditId || !hermesRunId || !KB_LIFECYCLE_STAGES.includes(stage)) throw new Error('invalid retrieval span identity');
  if (!['search', 'query', 'get_page', 'think'].includes(toolName)) throw new Error('unsupported read-only KB tool');
  return {
    spanId: id(), auditId, hermesRunId, stage, toolName, kbVersion,
    queryFingerprint: createHash('sha256').update(JSON.stringify(args ?? {})).digest('hex'),
    startedAt: now(), outcome: 'RUNNING'
  };
}

export function finishRetrievalSpan(span, result, { now = () => new Date().toISOString(), errorCode } = {}) {
  if (span.outcome !== 'RUNNING') throw new Error('retrieval span is already terminal');
  const endedAt = now();
  const latencyMs = Math.max(0, Date.parse(endedAt) - Date.parse(span.startedAt));
  const recordIds = result ? extractRecordIds(result).slice(0, 6) : [];
  return { ...span, endedAt, latencyMs, outcome: errorCode ? 'FAILED' : 'SUCCEEDED', resultCount: recordIds.length, recordIds, ...(errorCode ? { errorCode } : {}) };
}

function extractRecordIds(result) {
  const rows = Array.isArray(result?.results) ? result.results : Array.isArray(result?.citations) ? result.citations : result?.id ? [result] : [];
  return [...new Set(rows.map((row) => row?.id).filter((id) => typeof id === 'string'))];
}

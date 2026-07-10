import type { AuditTransport, AuditView, IntakeInput } from "../lib/contracts";

const fixture: AuditView = {
  auditId: "aud_demo_krus_01",
  status: "FREE_REPORT",
  direction: "KR_TO_US",
  homepageUrl: "https://example.co.kr",
  hermesRunId: "run_navitas_4f7b",
  degraded: false,
  events: [
    { schemaVersion: "1.0", auditId: "aud_demo_krus_01", eventId: "1", seq: 1, type: "RUN_CREATED", actor: "RUNTIME", status: "QUEUED", safeLabel: "Hermes audit run created", occurredAt: "09:41:04" },
    { schemaVersion: "1.0", auditId: "aud_demo_krus_01", eventId: "2", seq: 2, type: "TOOL_COMPLETED", actor: "HERMES_PARENT", status: "SUCCEEDED", toolName: "capture_site", safeLabel: "Captured the source and target homepages", occurredAt: "09:41:17" },
    { schemaVersion: "1.0", auditId: "aud_demo_krus_01", eventId: "3", seq: 3, type: "TOOL_COMPLETED", actor: "HERMES_PARENT", status: "SUCCEEDED", toolName: "search_market_evidence", safeLabel: "Retrieved live market evidence", occurredAt: "09:41:24" },
    { schemaVersion: "1.0", auditId: "aud_demo_krus_01", eventId: "4", seq: 4, type: "DELEGATION_STARTED", actor: "HERMES_PARENT", status: "RUNNING", toolName: "delegate_task", safeLabel: "Delegated bounded visual, copy, and evidence review", occurredAt: "09:41:30" },
    { schemaVersion: "1.0", auditId: "aud_demo_krus_01", eventId: "5", seq: 5, type: "DELEGATION_COMPLETED", actor: "HERMES_CHILD", status: "SUCCEEDED", toolName: "delegate_task", safeLabel: "Specialist reviews returned to Hermes", occurredAt: "09:41:52" },
    { schemaVersion: "1.0", auditId: "aud_demo_krus_01", eventId: "6", seq: 6, type: "REPORT_ACCEPTED", actor: "HERMES_PARENT", status: "SUCCEEDED", toolName: "submit_report", safeLabel: "Published three screenshot-grounded findings", occurredAt: "09:42:09" }
  ],
  report: {
    reportId: "rep_demo_01",
    title: "Your US landing page is ready for a sharper first impression.",
    executiveSummary: "The page carries the product benefit across languages, but its proof and CTA still ask a US buyer to do too much interpretation. These three revisions preserve the original intent while making the value and next step more native.",
    sourceUrl: "example.co.kr/ko",
    targetUrl: "example.co.kr/en",
    sourceLocale: "ko-KR",
    targetLocale: "en-US",
    screenshotLabels: ["Korean source", "US English target"],
    liveMarketEvidence: "AVAILABLE",
    limitations: ["This preview assessed one public homepage locale pair.", "Screenshots document the audited state; navitas.ai does not modify your site."],
    findings: [
      { findingId: "f_1", rank: 1, componentType: "HERO_HEADLINE", severity: "HIGH", sourceCopy: "팀의 모든 일이 한 곳에서", currentTargetCopy: "All your team's work in one place", proposedTargetCopy: "Give every team one clear place to move work forward.", businessImpact: "A result-led statement gives an unfamiliar buyer a faster reason to care.", rationale: "The revised line keeps the unified-workspace promise but introduces a concrete business outcome before the category claim.", confidence: 0.91, evidenceRefs: [{ packId: "evi_us_b2b_01", evidenceId: "web_1" }], kbRefs: ["gold_kr_us_headline_01"] },
      { findingId: "f_2", rank: 2, componentType: "PRIMARY_CTA", severity: "HIGH", sourceCopy: "무료로 시작하기", currentTargetCopy: "Start for free", proposedTargetCopy: "See how your team works better", businessImpact: "The CTA better matches an evaluation-stage visitor who needs value before commitment.", rationale: "A low-commitment, outcome-oriented CTA is clearer beside a broad hero promise and retains the original invitation.", confidence: 0.88, evidenceRefs: [{ packId: "evi_us_b2b_01", evidenceId: "web_2" }], kbRefs: ["gold_kr_us_cta_01"] },
      { findingId: "f_3", rank: 3, componentType: "TRUST_COPY", severity: "MEDIUM", sourceCopy: "10,000개 이상의 팀이 선택", currentTargetCopy: "Chosen by over 10,000 teams", proposedTargetCopy: "Trusted by 10,000+ teams building better workflows", businessImpact: "Specific, contextual proof makes the social signal work harder near the conversion moment.", rationale: "The recommendation preserves the claim while tying it directly to the customer outcome visible in the hero.", confidence: 0.84, evidenceRefs: [{ packId: "evi_us_b2b_01", evidenceId: "web_3" }], kbRefs: ["gold_kr_us_trust_01"] }
    ]
  }
};

export const fixtureTransport: AuditTransport = {
  async submit(input: IntakeInput) {
    return { ...fixture, auditId: `aud_${crypto.randomUUID()}`, homepageUrl: input.homepageUrl, direction: input.direction, status: "FREE_RUNNING", events: fixture.events.slice(0, 2), report: undefined };
  },
  async get() { return fixture; },
  async createCheckout() { return { checkoutUrl: "#checkout-opened" }; }
};

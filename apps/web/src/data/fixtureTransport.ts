import { canTransition, localesFor } from "@nativas/contracts";
import type {
  AgentEvent,
  AuditReport,
  AuditStatus,
  AuditTransport,
  AuditView,
  IntakeInput,
  PaidReport,
  PagePairSummary,
} from "../lib/contracts";

/**
 * Deterministic fixture adapter. Scenario is selected by keywords in the
 * submitted URL (fixture mode only, visibly labeled in the UI):
 *   "capture-fail" -> CAPTURE_INCOMPLETE terminal failure
 *   "blocked"      -> BLOCKED_BY_ORIGIN terminal failure
 *   "degraded"     -> Linkup unavailable, KB-only degraded report
 *   "slow-pay"     -> delayed webhook confirmation after checkout
 * State persists in sessionStorage so a mid-run refresh recovers truthfully.
 */

const STORE_KEY = "nativas.fixture.audits.v1";

const fixturePairs: PagePairSummary[] = [
  {
    pairId: "pair_pricing",
    role: "PRICING",
    sourceUrl: "https://example.co.kr/ko/pricing",
    targetUrl: "https://example.co.kr/en/pricing",
    sourceLocale: "ko-KR",
    targetLocale: "en-US",
    pairingMethod: "HREFLANG",
    sourceScreenshotId: "shot_pricing_ko",
    targetScreenshotId: "shot_pricing_en",
  },
  {
    pairId: "pair_product",
    role: "PRODUCT",
    sourceUrl: "https://example.co.kr/ko/product",
    targetUrl: "https://example.co.kr/en/product",
    sourceLocale: "ko-KR",
    targetLocale: "en-US",
    pairingMethod: "LANGUAGE_SWITCH",
    sourceScreenshotId: "shot_product_ko",
    targetScreenshotId: "shot_product_en",
  },
];

function buildPaidReport(auditId: string, parentAuditId: string, degraded: boolean): PaidReport {
  return {
    schemaVersion: "1.0",
    reportId: "rep_fixture_paid_01",
    auditId,
    jobType: "PAID",
    parentAuditId,
    auditedPairIds: fixturePairs.map((pair) => pair.pairId),
    title: "Two more surfaces, localized as one coherent buying journey.",
    executiveSummary: "Hermes found the strongest mismatch in how pricing earns trust and how the product page names the outcome. Six bounded revisions now align both surfaces for a US buyer.",
    liveMarketEvidence: degraded ? "DEGRADED" : "AVAILABLE",
    limitations: [
      "This paid audit covers two additional public locale pairs, not the entire website.",
      "Screenshots document the captured state; nativas.ai made no site changes.",
      ...(degraded ? ["Live Linkup evidence was unavailable; reviewed golden references were used instead."] : []),
    ],
    findings: fixturePairs.flatMap((pair, pairIndex) => [1, 2, 3].map((itemIndex) => {
      const rank = pairIndex * 3 + itemIndex;
      return {
        findingId: `paid_finding_${rank}`,
        rank,
        pairId: pair.pairId,
        targetUrl: pair.targetUrl,
        screenshotArtifactId: pair.targetScreenshotId!,
        componentRef: { kind: "ACCESSIBILITY_NAME" as const, value: itemIndex === 1 ? "Primary page heading" : itemIndex === 2 ? "Plan comparison" : "Primary CTA" },
        componentType: itemIndex === 1 ? "HERO_HEADLINE" : itemIndex === 2 ? "VALUE_PROPOSITION" : "PRIMARY_CTA",
        severity: rank <= 2 ? "HIGH" as const : "MEDIUM" as const,
        issueType: itemIndex === 1 ? "VALUE_PROP_CLARITY" as const : itemIndex === 2 ? "CULTURAL_TONE" as const : "CTA_MARKET_FIT" as const,
        sourceCopy: itemIndex === 1 ? "모든 업무를 한 곳에서" : itemIndex === 2 ? "비즈니스 플랜" : "시작하기",
        currentTargetCopy: itemIndex === 1 ? "Everything you need" : itemIndex === 2 ? "Business plan" : "Get started",
        proposedTargetCopy: itemIndex === 1 ? "Move from first workflow to measurable momentum" : itemIndex === 2 ? "Scale cross-team work without scaling coordination" : "See the workflow on your team",
        businessImpact: "The revision gives an evaluation-stage buyer a concrete outcome and a lower-friction next step.",
        rationale: "The recommendation preserves the source meaning while matching the information hierarchy and decision context visible in the captured target page.",
        confidence: 0.9 - rank * 0.02,
        evidenceRefs: degraded ? [] : [{ packId: `linkup_${pairIndex + 1}`, evidenceId: `evidence_${itemIndex}` }],
        kbRefs: [`gold_${pair.role.toLowerCase()}_${itemIndex}`],
      };
    })),
    generation: { hermesRunId: "run_fx_paid_report", contractVersion: "1.0", promptVersion: "fixture-v1", skillVersion: "fixture-v1", kbVersion: "fixture-v1" },
    generatedAt: nowIso(),
  };
}

type Step = { afterMs: number; apply(view: AuditView): AuditView };

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function makeEvent(view: AuditView, partial: Omit<AgentEvent, "schemaVersion" | "auditId" | "eventId" | "seq" | "occurredAt">): AgentEvent {
  const seq = view.events.length + 1;
  return {
    schemaVersion: "1.0",
    auditId: view.auditId,
    eventId: `fixture:${view.auditId}:${seq}`,
    seq,
    occurredAt: nowIso(),
    ...partial,
  };
}

function pushEvent(view: AuditView, partial: Parameters<typeof makeEvent>[1], status?: AuditStatus): AuditView {
  const next: AuditView = { ...view, events: [...view.events, makeEvent(view, partial)] };
  if (status && status !== view.status) {
    if (!canTransition(view.status, status)) return next; // never fabricate an illegal transition
    next.status = status;
  }
  return next;
}

function buildReport(input: IntakeInput, degraded: boolean): AuditReport {
  const [sourceLocale, targetLocale] = localesFor(input.direction);
  const host = (() => { try { return new URL(input.homepageUrl).host; } catch { return input.homepageUrl; } })();
  return {
    reportId: "rep_fixture_01",
    title: "Your US landing page is ready for a sharper first impression.",
    executiveSummary:
      "The page carries the product benefit across languages, but its proof and CTA still ask a US buyer to do too much interpretation. These three revisions preserve the original intent while making the value and next step more native.",
    sourceUrl: `${host}/${sourceLocale.slice(0, 2)}`,
    targetUrl: `${host}/${targetLocale.slice(0, 2)}`,
    sourceLocale,
    targetLocale,
    screenshotLabels: sourceLocale === "ko-KR" ? ["Korean source", "US English target"] : ["US English source", "Korean target"],
    visualEvidence: {
      mode: "HTML_TEXT_SNAPSHOT",
      source: { headline: "팀의 모든 일이 한 곳에서", supportingCopy: "더 빠르게 협업하고, 중요한 일에 집중하세요.", cta: "무료로 시작하기" },
      target: { headline: "All your team's work in one place", supportingCopy: "Build better workflows. Stay focused on what matters.", cta: "Start for free" },
    },
    liveMarketEvidence: degraded ? "DEGRADED" : "AVAILABLE",
    limitations: [
      "This preview assessed one public homepage locale pair.",
      "HTML text snapshots document the audited state; nativas.ai does not modify your site.",
      ...(degraded
        ? ["Live market research was unavailable for this run; findings rely on the curated golden knowledge base only."]
        : []),
    ],
    findings: [
      {
        findingId: "finding_1", rank: 1, componentType: "HERO_HEADLINE", issueType: "VALUE_PROP_CLARITY", severity: "HIGH",
        componentRef: { kind: "ACCESSIBILITY_NAME", value: "hero heading" },
        sourceCopy: "팀의 모든 일이 한 곳에서",
        currentTargetCopy: "All your team's work in one place",
        proposedTargetCopy: "Give every team one clear place to move work forward.",
        businessImpact: "A result-led statement gives an unfamiliar buyer a faster reason to care.",
        rationale: "The revised line keeps the unified-workspace promise but introduces a concrete business outcome before the category claim.",
        confidence: 0.91,
        evidenceRefs: degraded ? [] : [{ packId: "evi_us_b2b_01", evidenceId: "web_1" }],
        kbRefs: ["gold_kr_us_headline_01"],
      },
      {
        findingId: "finding_2", rank: 2, componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH",
        componentRef: { kind: "ACCESSIBILITY_NAME", value: "hero primary call to action" },
        sourceCopy: "무료로 시작하기",
        currentTargetCopy: "Start for free",
        proposedTargetCopy: "See how your team works better",
        businessImpact: "The CTA better matches an evaluation-stage visitor who needs value before commitment.",
        rationale: "A low-commitment, outcome-oriented CTA is clearer beside a broad hero promise and retains the original invitation.",
        confidence: 0.88,
        evidenceRefs: degraded ? [] : [{ packId: "evi_us_b2b_01", evidenceId: "web_2" }],
        kbRefs: ["gold_kr_us_cta_01"],
      },
      {
        findingId: "finding_3", rank: 3, componentType: "TRUST_COPY", issueType: "TRUST_SIGNAL", severity: "MEDIUM",
        componentRef: { kind: "TEXT_ANCHOR", value: "social proof strip" },
        sourceCopy: "10,000개 이상의 팀이 선택",
        currentTargetCopy: "Chosen by over 10,000 teams",
        proposedTargetCopy: "Trusted by 10,000+ teams building better workflows",
        businessImpact: "Specific, contextual proof makes the social signal work harder near the conversion moment.",
        rationale: "The recommendation preserves the claim while tying it directly to the customer outcome visible in the hero.",
        confidence: 0.84,
        evidenceRefs: degraded ? [] : [{ packId: "evi_us_b2b_01", evidenceId: "web_3" }],
        kbRefs: ["gold_kr_us_trust_01"],
      },
    ],
  };
}

function buildSteps(input: IntakeInput): Step[] {
  const url = input.homepageUrl.toLowerCase();
  const captureFail = url.includes("capture-fail");
  const blocked = url.includes("blocked");
  const degraded = url.includes("degraded");
  const runId = `run_fx_${Math.random().toString(36).slice(2, 8)}`;

  const steps: Step[] = [
    { afterMs: 1, apply: (v) => pushEvent(v, { type: "RUN_CREATED", actor: "RUNTIME", status: "QUEUED", safeLabel: "Hermes audit run created", hermesRunId: runId }, "ELIGIBILITY_CHECK") },
    { afterMs: 2, apply: (v) => pushEvent({ ...v, hermesRunId: runId }, { type: "RUN_STARTED", actor: "RUNTIME", status: "RUNNING", safeLabel: "Hermes parent run is active", hermesRunId: runId }, "FREE_RUNNING") },
    { afterMs: 3, apply: (v) => pushEvent(v, { type: "PLAN_READY", actor: "HERMES_PARENT", status: "SUCCEEDED", safeLabel: "Audit plan prepared within contract limits", hermesRunId: runId }) },
    { afterMs: 4, apply: (v) => pushEvent(v, { type: "TOOL_STARTED", actor: "HERMES_PARENT", status: "RUNNING", toolName: "capture_site", safeLabel: "Capturing the source and target homepages", hermesRunId: runId }) },
  ];

  if (blocked || captureFail) {
    const code = blocked ? "BLOCKED_BY_ORIGIN" : "CAPTURE_INCOMPLETE";
    const message = blocked
      ? "The site's origin refused automated capture. We do not retry with alternate crawlers."
      : "A required screenshot or page artifact was missing, so the locale pair could not be captured completely.";
    steps.push({
      afterMs: 5,
      apply: (v) => {
        let next = pushEvent(v, { type: "TOOL_FAILED", actor: "HERMES_PARENT", status: "FAILED", toolName: "capture_site", safeLabel: "Homepage capture failed", hermesRunId: runId });
        next = pushEvent(next, { type: "RUN_FAILED", actor: "RUNTIME", status: "FAILED", safeLabel: "Run stopped with a typed failure", hermesRunId: runId }, "FAILED");
        return { ...next, error: { code, class: "TERMINAL", message } };
      },
    });
    return steps;
  }

  steps.push(
    { afterMs: 5, apply: (v) => pushEvent(v, { type: "TOOL_COMPLETED", actor: "HERMES_PARENT", status: "SUCCEEDED", toolName: "capture_site", safeLabel: "Captured one homepage locale pair with full evidence artifacts", hermesRunId: runId }) },
    { afterMs: 6, apply: (v) => pushEvent(v, { type: "TOOL_STARTED", actor: "HERMES_PARENT", status: "RUNNING", toolName: "search_market_evidence", safeLabel: "Retrieving bounded live market evidence", hermesRunId: runId }) },
    degraded
      ? { afterMs: 7, apply: (v) => ({ ...pushEvent(v, { type: "TOOL_FAILED", actor: "HERMES_PARENT", status: "FAILED", toolName: "search_market_evidence", safeLabel: "Live market research unavailable; continuing with curated KB evidence", hermesRunId: runId }), degraded: true }) }
      : { afterMs: 7, apply: (v) => pushEvent(v, { type: "TOOL_COMPLETED", actor: "HERMES_PARENT", status: "SUCCEEDED", toolName: "search_market_evidence", safeLabel: "Retrieved live market evidence", hermesRunId: runId }) },
    { afterMs: 8, apply: (v) => pushEvent(v, { type: "DELEGATION_STARTED", actor: "HERMES_PARENT", status: "RUNNING", toolName: "delegate_task", safeLabel: "Delegated bounded visual, copy, and evidence review", hermesRunId: runId }) },
    { afterMs: 9, apply: (v) => pushEvent(v, { type: "DELEGATION_COMPLETED", actor: "HERMES_CHILD", status: "SUCCEEDED", toolName: "delegate_task", safeLabel: "Specialist reviews returned to Hermes", hermesRunId: runId }) },
    {
      afterMs: 10,
      apply: (v) => {
        const next = pushEvent(v, { type: "REPORT_ACCEPTED", actor: "HERMES_PARENT", status: "SUCCEEDED", toolName: "submit_report", safeLabel: "Published three screenshot-grounded findings", hermesRunId: runId }, "FREE_REPORT");
        return { ...next, report: buildReport(input, degraded) };
      },
    },
  );
  return steps;
}

type Listener = (view: AuditView) => void;

export function createFixtureTransport(tickMs = 650): AuditTransport {
  const listeners = new Map<string, Set<Listener>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

  function readStore(): Record<string, AuditView> {
    try {
      return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }
  function save(view: AuditView) {
    const all = readStore();
    all[view.auditId] = view;
    sessionStorage.setItem(STORE_KEY, JSON.stringify(all));
    for (const listener of listeners.get(view.auditId) ?? []) listener(view);
  }
  function schedule(auditId: string, steps: Step[]) {
    const handles = steps.map((step, index) =>
      setTimeout(() => {
        const current = readStore()[auditId];
        if (!current || current.status === "CANCELLED" || current.status === "FAILED") return;
        save(step.apply(current));
      }, Math.max(1, step.afterMs * tickMs / 5) + index),
    );
    timers.set(auditId, handles);
  }

  return {
    mode: "FIXTURE",
    async submit(input) {
      const auditId = `aud_fx_${Math.random().toString(36).slice(2, 10)}`;
      const view: AuditView = {
        auditId,
        status: "SUBMITTED",
        direction: input.direction,
        homepageUrl: input.homepageUrl,
        audience: input.audience,
        launchGoal: input.launchGoal,
        degraded: false,
        events: [],
      };
      save(view);
      schedule(auditId, buildSteps(input));
      return view;
    },
    async get(auditId) {
      return readStore()[auditId] ?? null;
    },
    subscribe(auditId, onChange) {
      const set = listeners.get(auditId) ?? new Set();
      set.add(onChange);
      listeners.set(auditId, set);
      return () => set.delete(onChange);
    },
    async cancel(auditId) {
      for (const handle of timers.get(auditId) ?? []) clearTimeout(handle);
      const current = readStore()[auditId];
      if (!current) throw new Error("Unknown audit");
      if (!canTransition(current.status, "CANCELLED")) return current;
      const next: AuditView = {
        ...pushEvent(current, { type: "RUN_CANCELLED", actor: "RUNTIME", status: "CANCELLED", safeLabel: "Run cancelled at the next safe point", hermesRunId: current.hermesRunId }, "CANCELLED"),
        error: { code: "CANCELLED", class: "TERMINAL", message: "You cancelled this audit. Nothing was published." },
      };
      save(next);
      return next;
    },
    async createCheckout(auditId) {
      const current = readStore()[auditId];
      if (!current) throw new Error("Unknown audit");
      if (current.status !== "FREE_REPORT") throw new Error("Checkout is only available from a completed free report.");
      // Idempotent: one payment and one paid audit per free audit.
      if (current.payment) return { checkoutUrl: "#fixture-dodo-checkout", paymentId: current.payment.paymentId };
      const paymentId = `pay_fx_${Math.random().toString(36).slice(2, 8)}`;
      save({ ...current, payment: { paymentId, status: "PENDING_CONFIRMATION" } });
      const slow = current.homepageUrl.toLowerCase().includes("slow-pay");
      const confirmDelay = (slow ? 6 : 2) * tickMs;
      const paidRunId = `run_fx_paid_${Math.random().toString(36).slice(2, 6)}`;
      setTimeout(() => {
        const view = readStore()[auditId];
        if (!view?.payment) return;
        const paidAuditId = `aud_fx_paid_${view.payment!.paymentId.slice(-4)}`;
        let next = pushEvent(view, { type: "PAYMENT_SUCCEEDED", actor: "PAYMENT", status: "SUCCEEDED", safeLabel: "Dodo payment verified by signed webhook" });
        next = { ...next, payment: { ...view.payment!, status: "SUCCEEDED" }, paidAuditId };
        next = pushEvent(next, { type: "PAID_RUN_QUEUED", actor: "RUNTIME", status: "QUEUED", safeLabel: "Paid continuation audit created and queued" });
        save(next);
        const child: AuditView = {
          auditId: paidAuditId,
          kind: "PAID",
          parentAuditId: auditId,
          status: "PAID_QUEUED",
          direction: view.direction,
          homepageUrl: view.homepageUrl,
          audience: view.audience,
          launchGoal: view.launchGoal,
          degraded: view.homepageUrl.includes("paid-degraded"),
          events: [],
          startedAt: nowIso(),
          payment: { ...view.payment!, status: "SUCCEEDED" },
        };
        save(child);
        setTimeout(() => {
          const queued = readStore()[paidAuditId];
          if (!queued) return;
          const parent = readStore()[auditId];
          if (parent) save({ ...parent, paidHermesRunId: paidRunId });
          const discovered = pushEvent(queued, { type: "DISCOVERY_COMPLETED", actor: "RUNTIME", status: "SUCCEEDED", safeLabel: "Selected pricing and product locale pairs" });
          save({ ...discovered, status: "PAID_RUNNING", selectedPairs: fixturePairs });
          setTimeout(() => {
            const capturing = readStore()[paidAuditId];
            if (!capturing) return;
            let active = pushEvent(capturing, { type: "CAPTURE_COMPLETED", actor: "RUNTIME", status: "SUCCEEDED", safeLabel: "Stored four rendered page screenshots" });
            active = pushEvent(active, { type: "RUN_STARTED", actor: "RUNTIME", status: "RUNNING", safeLabel: "Paid Hermes manager is active", hermesRunId: paidRunId });
            active = pushEvent(active, { type: "DELEGATION_STARTED", actor: "HERMES_PARENT", status: "RUNNING", safeLabel: "Visual, native-copy, and evidence specialists started", hermesRunId: paidRunId });
            save({
            ...active,
            paidHermesRunId: paidRunId,
            hermesRunId: paidRunId,
          });
            setTimeout(() => {
              const running = readStore()[paidAuditId];
              if (!running) return;
              let complete = pushEvent(running, { type: "DELEGATION_COMPLETED", actor: "HERMES_CHILD", status: "SUCCEEDED", safeLabel: "Three specialist reviews returned", hermesRunId: paidRunId });
              complete = pushEvent(complete, { type: "REPORT_ACCEPTED", actor: "HERMES_PARENT", status: "SUCCEEDED", safeLabel: "Validated and persisted six findings", hermesRunId: paidRunId });
              save({ ...complete, status: "PAID_REPORT", paidReport: buildPaidReport(paidAuditId, auditId, running.degraded) });
            }, tickMs);
          }, tickMs);
        }, tickMs);
      }, confirmDelay);
      return { checkoutUrl: "#fixture-dodo-checkout", paymentId };
    },
    artifactUrl(_auditId, artifactId) {
      const label = encodeURIComponent(artifactId.replaceAll("_", " "));
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='600' viewBox='0 0 960 600'%3E%3Crect width='960' height='600' fill='%23e9edea'/%3E%3Crect x='54' y='74' width='852' height='452' rx='12' fill='%23b9d6c6'/%3E%3Ctext x='96' y='170' font-family='sans-serif' font-size='23' fill='%2314201d'%3EFixture screenshot evidence%3C/text%3E%3Ctext x='96' y='220' font-family='monospace' font-size='16' fill='%233f5d50'%3E${label}%3C/text%3E%3C/svg%3E`;
    },
  };
}

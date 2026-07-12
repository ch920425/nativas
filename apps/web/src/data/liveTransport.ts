import type { AuditTransport, AuditView, CheckoutSession, IntakeInput } from "../lib/contracts";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type LiveTransportOptions = { fetchImpl?: FetchLike; pollMs?: number };

const alwaysTerminal = new Set(["PAID_REPORT", "FAILED", "CANCELLED"]);

function isTerminal(view: AuditView) {
  if (alwaysTerminal.has(view.status)) return true;
  if (view.status !== "FREE_REPORT") return false;
  return view.payment?.status !== "PENDING_CONFIRMATION";
}

export function createLiveTransport(apiBase: string, options: LiveTransportOptions = {}): AuditTransport {
  const fetchImpl = options.fetchImpl ?? fetch;
  const pollMs = options.pollMs ?? 750;
  const base = apiBase.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit, allowNotFound = false): Promise<T | null> {
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as { error?: string; message?: string };
      throw new Error(payload.error ?? payload.message ?? `HTTP ${response.status}`);
    }
    return await response.json() as T;
  }

  return {
    mode: "LIVE",
    async submit(input: IntakeInput) {
      return (await request<AuditView>("/api/audits", { method: "POST", body: JSON.stringify(input) }))!;
    },
    async get(auditId: string) {
      return await request<AuditView>(`/api/audits/${encodeURIComponent(auditId)}`, undefined, true);
    },
    subscribe(auditId: string, onChange: (view: AuditView) => void) {
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let previous = "";
      const poll = async () => {
        if (!active) return;
        try {
          const view = await request<AuditView>(`/api/audits/${encodeURIComponent(auditId)}`, undefined, true);
          if (view) {
            const serialized = JSON.stringify(view);
            if (serialized !== previous) {
              previous = serialized;
              onChange(view);
            }
            if (isTerminal(view)) {
              active = false;
              return;
            }
          }
        } catch {
          // A transient polling failure must not fabricate state or end the run.
        }
        if (active) timer = setTimeout(poll, pollMs);
      };
      void poll();
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    },
    async cancel(auditId: string) {
      return (await request<AuditView>(`/api/audits/${encodeURIComponent(auditId)}/cancel`, { method: "POST", body: "{}" }))!;
    },
    async createCheckout(auditId: string) {
      return (await request<CheckoutSession>(`/api/audits/${encodeURIComponent(auditId)}/checkout`, { method: "POST", body: "{}" }))!;
    },
  };
}

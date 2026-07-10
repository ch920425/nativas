import type { AuditTransport } from "../lib/contracts";
import { createFixtureTransport } from "./fixtureTransport";
import { createLiveTransport } from "./liveTransport";

/**
 * Single swap point for Lane 2. Set VITE_TRANSPORT=live once the Convex
 * adapter (implementing AuditTransport over convex/react) is checked in.
 */
export function createTransport(): AuditTransport {
  const mode = import.meta.env?.VITE_TRANSPORT ?? "fixture";
  if (mode === "live") {
    return createLiveTransport(import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787");
  }
  return createFixtureTransport();
}

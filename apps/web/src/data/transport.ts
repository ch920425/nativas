import type { AuditTransport } from "../lib/contracts";
import { createFixtureTransport } from "./fixtureTransport";

/**
 * Single swap point for Lane 2. Set VITE_TRANSPORT=live once the Convex
 * adapter (implementing AuditTransport over convex/react) is checked in.
 */
export function createTransport(): AuditTransport {
  const mode = import.meta.env?.VITE_TRANSPORT ?? "fixture";
  if (mode === "live") {
    throw new Error(
      "Live Convex transport is not wired in this lane. Implement AuditTransport over Convex queries/actions and return it here.",
    );
  }
  return createFixtureTransport();
}

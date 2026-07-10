import { assertCompleteCapture, assertSafeCaptureUrl, REQUIRED_CAPTURE_KINDS } from "../../../apps/runtime/src/adapters.ts";
export type CaptureResponse = { artifacts: Array<{ kind: string; bytes: number }>; sourceUrl: string };
export async function capturePublicPage(url: string, snapshot: (url: string, formats: readonly string[]) => Promise<CaptureResponse>) { assertSafeCaptureUrl(url); const response = await snapshot(url, REQUIRED_CAPTURE_KINDS); assertCompleteCapture(response.artifacts.map((artifact) => artifact.kind)); return response; }

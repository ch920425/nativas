import { assertCompleteCapture, assertPublicResolution, assertSafeCaptureUrl, REQUIRED_CAPTURE_KINDS } from "../../../apps/runtime/src/adapters.ts";

export type CaptureResponse = { artifacts: Array<{ kind: string; bytes: number }>; sourceUrl: string; browserMsUsed?: number };
export type CaptureDependencies = {
  resolve(hostname: string): Promise<string[]>;
  preflight(url: string): Promise<{ finalUrl: string; redirects: string[]; contentLength?: number }>;
  snapshot(url: string, formats: readonly string[]): Promise<CaptureResponse>;
};

export async function capturePublicPage(rawUrl: string, dependencies: CaptureDependencies, limits = { maxRedirects: 3, maxBytes: 12_000_000 }): Promise<CaptureResponse> {
  const submitted = assertSafeCaptureUrl(rawUrl);
  await assertPublicResolution(submitted, dependencies.resolve);
  const preflight = await dependencies.preflight(submitted.href);
  if (preflight.redirects.length > limits.maxRedirects || (preflight.contentLength ?? 0) > limits.maxBytes) throw new Error("CAPTURE_INCOMPLETE");
  for (const hop of [...preflight.redirects, preflight.finalUrl]) {
    const url = assertSafeCaptureUrl(hop);
    await assertPublicResolution(url, dependencies.resolve);
  }
  const response = await dependencies.snapshot(preflight.finalUrl, REQUIRED_CAPTURE_KINDS);
  assertCompleteCapture(response.artifacts.map((artifact) => artifact.kind));
  if (response.artifacts.reduce((total, artifact) => total + artifact.bytes, 0) > limits.maxBytes) throw new Error("CAPTURE_INCOMPLETE");
  return response;
}

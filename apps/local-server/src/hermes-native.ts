import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import type { HermesEvent, HermesRunClient, HermesRunResult } from "./service.ts";

export class HermesNativeClient implements HermesRunClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async createRun(input: { input: string; instructions: string; session_id: string }) {
    const response = await this.request("/v1/runs", { method: "POST", body: JSON.stringify(input) });
    const payload = await response.json() as { run_id?: string };
    if (!payload.run_id) throw new Error("HERMES_START_FAILED");
    return { run_id: payload.run_id };
  }

  async waitForRun(runId: string, onEvent: (event: HermesEvent) => void): Promise<HermesRunResult> {
    const events = this.consumeEvents(runId, onEvent).catch(() => undefined);
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
      const response = await this.request(`/v1/runs/${encodeURIComponent(runId)}`);
      const payload = await response.json() as Record<string, unknown>;
      const status = String(payload.status ?? "");
      if (["completed", "failed", "cancelled"].includes(status)) {
        await Promise.race([events, new Promise((resolve) => setTimeout(resolve, 1500))]);
        return { status: status as HermesRunResult["status"], output: typeof payload.output === "string" ? payload.output : undefined, error: typeof payload.error === "string" ? payload.error : undefined, usage: payload.usage as HermesRunResult["usage"] };
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    await this.stopRun(runId).catch(() => undefined);
    throw new Error("HERMES_RUN_FAILED:timeout");
  }

  async stopRun(runId: string) {
    await this.request(`/v1/runs/${encodeURIComponent(runId)}/stop`, { method: "POST", body: "{}" });
  }

  private async consumeEvents(runId: string, onEvent: (event: HermesEvent) => void) {
    const response = await this.request(`/v1/runs/${encodeURIComponent(runId)}/events`);
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try { onEvent(JSON.parse(data) as HermesEvent); } catch { /* ignore malformed observability frames */ }
      }
      if (done) break;
    }
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", ...init?.headers } });
    if (!response.ok) throw new Error(`Hermes ${response.status}: ${await response.text()}`);
    return response;
  }
}

export async function startManagedHermes(logPath: string, port = 8642): Promise<{ client: HermesNativeClient; close(): Promise<void> }> {
  const configuredBase = process.env.NATIVAS_HERMES_BASE_URL;
  const configuredKey = process.env.NATIVAS_HERMES_API_KEY;
  if (configuredBase && configuredKey) return { client: new HermesNativeClient(configuredBase, configuredKey), async close() {} };

  const apiKey = randomBytes(32).toString("hex");
  const baseUrl = `http://127.0.0.1:${port}`;
  await mkdir(dirname(logPath), { recursive: true });
  const log = createWriteStream(logPath, { flags: "a" });
  const command = process.env.NATIVAS_HERMES_COMMAND ?? "hermes";
  const profile = process.env.NATIVAS_HERMES_PROFILE ?? "nativas";
  const child = spawn(command, ["-p", profile, "gateway", "run", "--force", "--accept-hooks"], {
    env: {
      ...process.env,
      API_SERVER_ENABLED: "true",
      API_SERVER_KEY: apiKey,
      API_SERVER_PORT: String(port),
      API_SERVER_HOST: "127.0.0.1",
      DELEGATION_MAX_CONCURRENT_CHILDREN: "3",
      DELEGATION_CHILD_TIMEOUT_SECONDS: process.env.NATIVAS_HERMES_CHILD_TIMEOUT_SECONDS ?? "45",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  await waitForGateway(baseUrl, apiKey, child);
  return {
    client: new HermesNativeClient(baseUrl, apiKey),
    async close() {
      await stopChild(child);
      log.end();
    },
  };
}

async function waitForGateway(baseUrl: string, apiKey: string, child: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Hermes gateway exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/v1/models`, { headers: { authorization: `Bearer ${apiKey}` } });
      if (response.ok) return;
    } catch { /* keep waiting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Hermes gateway did not become ready");
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

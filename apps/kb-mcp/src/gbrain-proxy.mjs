#!/usr/bin/env node
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { describeGbrainEngine, resolveGbrainEngine } from './gbrain-env.mjs';
import { ALLOWED_GBRAIN_TOOLS, sanitizeGbrainToolCall } from './gbrain-policy.mjs';

const resolved = resolveGbrainEngine(process.env);
process.stderr.write(`nativas gbrain proxy engine: ${JSON.stringify(describeGbrainEngine(resolved))}\n`);
const upstream = spawn('gbrain', ['serve'], { env: resolved.env, stdio: ['pipe', 'pipe', 'inherit'] });
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const output = readline.createInterface({ input: upstream.stdout, crlfDelay: Infinity });

await Promise.all([
  (async () => {
    for await (const line of input) {
      if (!line.trim()) continue;
      try {
        const request = JSON.parse(line);
        if (request.method === 'tools/call') {
          const name = request.params?.name;
          request.params.arguments = sanitizeGbrainToolCall(name, request.params?.arguments);
        }
        upstream.stdin.write(`${JSON.stringify(request)}\n`);
      } catch (error) {
        process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32602, message: error instanceof Error ? error.message : 'invalid KB call' } })}\n`);
      }
    }
    upstream.stdin.end();
  })(),
  (async () => {
    for await (const line of output) {
      if (!line.trim()) continue;
      const response = JSON.parse(line);
      if (Array.isArray(response?.result?.tools)) response.result.tools = response.result.tools.filter((tool) => ALLOWED_GBRAIN_TOOLS.includes(tool.name));
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  })()
]);

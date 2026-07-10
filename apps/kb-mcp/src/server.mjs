#!/usr/bin/env node
import readline from "node:readline";
import { getPage, loadCorpus, retrieve } from "./retrieval.mjs";

const tools = [
  {
    name: "search",
    description: "Read-only bounded lookup of nativas.ai golden localization records. Returns at most three records.",
    inputSchema: { type: "object", required: ["direction"], properties: { direction: { enum: ["KR_TO_US", "US_TO_KR"] }, componentType: { enum: ["HERO_HEADLINE", "VALUE_PROPOSITION", "PRIMARY_CTA", "TRUST_COPY"] }, query: { type: "string" }, industry: { type: "string" }, audience: { type: "string" }, issueHypothesis: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 3 } } }
  },
  {
    name: "query",
    description: "Read-only semantic-style alias for bounded golden-record lookup; deterministic keyword ranking in demo mode.",
    inputSchema: { type: "object", required: ["direction"], properties: { direction: { enum: ["KR_TO_US", "US_TO_KR"] }, componentType: { enum: ["HERO_HEADLINE", "VALUE_PROPOSITION", "PRIMARY_CTA", "TRUST_COPY"] }, query: { type: "string" }, industry: { type: "string" }, audience: { type: "string" }, issueHypothesis: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 3 } } }
  },
  {
    name: "get_page",
    description: "Read one golden record by stable ID.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } }
  }
];

const corpus = await loadCorpus();
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  let request;
  try {
    request = JSON.parse(line);
    const result = await handle(request);
    reply({ jsonrpc: "2.0", id: request.id, result });
  } catch (error) {
    reply({ jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32000, message: error instanceof Error ? error.message : "KB server error" } });
  }
}

async function handle(request) {
  if (request.method === "initialize") return { protocolVersion: request.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "nativas-kb", version: "1.0.0" } };
  if (request.method === "notifications/initialized") return {};
  if (request.method === "tools/list") return { tools };
  if (request.method !== "tools/call") throw new Error(`unsupported method ${request.method}`);
  const { name, arguments: args = {} } = request.params ?? {};
  const data = name === "get_page" ? getPage(corpus, args.id) : (name === "search" || name === "query" ? retrieve(corpus, args) : (() => { throw new Error(`unknown tool ${name}`); })());
  return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
}

function reply(payload) { process.stdout.write(`${JSON.stringify(payload)}\n`); }

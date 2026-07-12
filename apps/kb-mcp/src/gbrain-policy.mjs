export const ALLOWED_GBRAIN_TOOLS = Object.freeze(['search', 'query', 'get_page', 'think']);

/** Field-level capability reduction before a call reaches the real gbrain MCP. */
export function sanitizeGbrainToolCall(name, args = {}) {
  if (!ALLOWED_GBRAIN_TOOLS.includes(name)) throw new Error(`gbrain tool ${name} is not allowed`);
  if (name === 'get_page') return { slug: requireText(args.slug ?? args.id, 'slug'), fuzzy: false, include_deleted: false };
  if (name === 'search') return { query: requireText(args.query, 'query'), limit: clamp(args.limit, 3), offset: 0 };
  if (name === 'query') return { query: requireText(args.query, 'query'), limit: clamp(args.limit, 3), offset: 0, expand: args.expand !== false, detail: 'summary' };
  return {
    question: requireText(args.question, 'question'),
    ...(args.anchor ? { anchor: requireText(args.anchor, 'anchor') } : {}),
    rounds: 1,
    save: false,
    take: false
  };
}

function requireText(value, key) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error(`${key} must be bounded text`);
  return value.trim();
}

function clamp(value, max) {
  return Math.min(Number.isInteger(value) && value > 0 ? value : max, max);
}

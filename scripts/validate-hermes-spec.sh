#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required=(
  "hermes/README.md"
  "hermes/config.example.yaml"
  "hermes/skills/manifest.json"
  "hermes/skills/nativas-manager/SKILL.md"
  "hermes/skills/nativas-visual-context/SKILL.md"
  "hermes/skills/nativas-market-copy/SKILL.md"
  "hermes/skills/nativas-evidence-qa/SKILL.md"
  "docs/hermes/local-runtime.md"
  "docs/hermes/discord-operations.md"
)

for relative in "${required[@]}"; do
  test -s "$ROOT/$relative" || {
    echo "missing or empty Hermes spec: $relative" >&2
    exit 1
  }
done

test -x "$ROOT/scripts/validate-hermes-spec.sh" || {
  echo "Hermes spec validator must be executable" >&2
  exit 1
}

python3 - "$ROOT" <<'PY'
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
manifest_path = root / "hermes/skills/manifest.json"
manifest = json.loads(manifest_path.read_text())

assert manifest["schemaVersion"] == "1.0"
assert manifest["profile"] == "nativas"
assert manifest["runtimeCompatibility"]["hermesVersion"] == "0.18.2"
assert manifest["runtimeCompatibility"]["delegationMode"] == "native-flat-leaf"
assert manifest["hashPolicy"] == "sha256-file-bytes-at-run-creation"

expected = {
    "nativas-manager": "hermes/skills/nativas-manager/SKILL.md",
    "nativas-visual-context": "hermes/skills/nativas-visual-context/SKILL.md",
    "nativas-market-copy": "hermes/skills/nativas-market-copy/SKILL.md",
    "nativas-evidence-qa": "hermes/skills/nativas-evidence-qa/SKILL.md",
}
entries = [manifest["manager"], *manifest["specialists"]]
actual = {entry["id"]: entry["path"] for entry in entries}
assert actual == expected, f"unexpected skill manifest: {actual}"
assert all(entry["version"] == "1.0.0" for entry in entries)
for relative in actual.values():
    path = (root / relative).resolve()
    assert path.is_relative_to(root.resolve()), f"skill path escapes repo: {relative}"
    assert path.is_file() and path.stat().st_size > 0, f"missing skill: {relative}"

config = (root / "hermes/config.example.yaml").read_text()
required_config = [
    r"platform_toolsets:\s*\n\s+api_server:",
    r"- delegation\b",
    r"- nativas_kb\b",
    r"- nativas_ops\b",
    r"max_concurrent_children:\s*3\b",
    r"max_spawn_depth:\s*1\b",
    r"orchestrator_enabled:\s*false\b",
    r"subagent_auto_approve:\s*false\b",
    r"inherit_mcp_toolsets:\s*false\b",
    r"GBRAIN_HOME:\s*/ABSOLUTE/PATH/TO/NATIVAS_RUNTIME/gbrain",
]
for pattern in required_config:
    assert re.search(pattern, config), f"missing safe Hermes config invariant: {pattern}"

kb_tools = re.search(
    r"nativas_kb:.*?tools:\s*\n\s+include:\s*\n(?P<body>(?:\s+- [^\n]+\n)+)",
    config,
    re.S,
)
ops_tools = re.search(
    r"nativas_ops:.*?tools:\s*\n\s+include:\s*\n(?P<body>(?:\s+- [^\n]+\n)+)",
    config,
    re.S,
)
assert kb_tools and ops_tools, "missing MCP include allowlists"
parse = lambda body: [line.split("-", 1)[1].strip() for line in body.splitlines()]
assert parse(kb_tools.group("body")) == ["search", "query", "get_page"]
assert parse(ops_tools.group("body")) == [
    "capture_site",
    "search_market_evidence",
    "submit_report",
]

manager = (root / "hermes/skills/nativas-manager/SKILL.md").read_text()
assert "parentCapability" in manager
assert "delegate_task(tasks=[...])" in manager
assert 'role: "leaf"' in manager
assert "exactly three" in manager

for relative in expected.values():
    text = (root / relative).read_text()
    assert "version: 1.0.0" in text
    if relative != expected["nativas-manager"]:
        assert "SpecialistResultV1" in text
        assert "Never call it, guess a `parentCapability`, or ask for one" in text

scanned = [
    root / "hermes/README.md",
    root / "hermes/config.example.yaml",
    root / "hermes/skills/manifest.json",
    root / "docs/hermes/local-runtime.md",
    root / "docs/hermes/discord-operations.md",
    *[root / path for path in expected.values()],
]
secret_patterns = [
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}"),
    re.compile("ctx7" + r"sk-[A-Za-z0-9-]{20,}"),
    re.compile(r"sk-[A-Za-z0-9]{24,}"),
]
for path in scanned:
    text = path.read_text()
    for pattern in secret_patterns:
        assert not pattern.search(text), f"possible committed secret in {path.relative_to(root)}"
PY

if find "$ROOT/hermes" "$ROOT/docs/hermes" -type f -name '.env*' -print -quit | grep -q .; then
  echo "Hermes specification directories must not contain .env files" >&2
  exit 1
fi

echo "Hermes specification validation passed."

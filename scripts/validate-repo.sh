#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

required=(
  AGENTS.md
  CLAUDE.md
  PRD.md
  README.txt
  TECH_SPEC.md
  docs/contracts/README.md
  docs/contracts/domain-model.md
  docs/contracts/fixtures.md
  docs/contracts/payment-continuation.md
  docs/contracts/report-and-evidence.md
  docs/contracts/runtime-api.md
  docs/agent-prompts/01-claude-frontend.md
  docs/agent-prompts/02-codex-backend-hermes.md
  docs/agent-prompts/03-codex-knowledge-base.md
  docs/validation/acceptance-gates.md
  docs/validation/rehearsal.md
  docs/validation/test-strategy.md
  docs/workstreams/frontend.md
  docs/workstreams/backend-runtime.md
  docs/workstreams/integration-plan.md
  docs/workstreams/knowledge-base.md
  .codex/skills/nativas-stack/SKILL.md
  .codex/skills/nativas-stack/references/service-contracts.md
)

for path in "${required[@]}"; do
  if [[ ! -s "$path" ]]; then
    echo "FAIL missing or empty: $path" >&2
    exit 1
  fi
done

if [[ "$(cat CLAUDE.md)" != "@AGENTS.md" ]]; then
  echo "FAIL CLAUDE.md must contain only @AGENTS.md" >&2
  exit 1
fi

if [[ ! -L .claude/skills ]] || [[ "$(readlink .claude/skills)" != "../.codex/skills" ]]; then
  echo "FAIL .claude/skills must be a thin bridge to ../.codex/skills" >&2
  exit 1
fi

while IFS= read -r skill; do
  head -n 1 "$skill" | grep -qx -- '---' || {
    echo "FAIL missing skill frontmatter: $skill" >&2
    exit 1
  }
  grep -q '^name:' "$skill" || {
    echo "FAIL missing skill name: $skill" >&2
    exit 1
  }
  grep -q '^description:' "$skill" || {
    echo "FAIL missing skill description: $skill" >&2
    exit 1
  }
done < <(find .codex/skills -name SKILL.md -type f | sort)

rg -q 'Linkup' AGENTS.md .codex/skills || {
  echo "FAIL Linkup-only search policy is not documented" >&2
  exit 1
}

rg -q 'Exa' AGENTS.md .codex/skills || {
  echo "FAIL explicit Exa prohibition is not documented" >&2
  exit 1
}

if rg -n --hidden --glob '!.git/**' --glob '!scripts/validate-repo.sh' 'navitas|Navitas|NAVITAS' .; then
  echo "FAIL stale navitas naming found; canonical product name is nativas.ai" >&2
  exit 1
fi

if rg -n --hidden --glob '!.git/**' --glob '!scripts/validate-repo.sh' \
  '\b(CHECKOUT_PENDING|DEEP_RUNNING|DEEP_REPORT|KR_US|US_KR|evidenceUrls|allowedHosts)\b' .; then
  echo "FAIL stale contract vocabulary found" >&2
  exit 1
fi

if [[ "$(find docs/workstreams -maxdepth 1 -type f -name '*.md' ! -name 'integration-plan.md' | wc -l | tr -d ' ')" != "3" ]]; then
  echo "FAIL exactly three implementation-lane documents are required" >&2
  exit 1
fi

rg -qi '90%.*risk-weighted|risk-weighted.*≥90' TECH_SPEC.md docs/validation/test-strategy.md || {
  echo "FAIL meaningful 90% test-surface policy is missing" >&2
  exit 1
}

read -r scenario_count total_weight p0_weight < <(
  awk -F'|' '
    /^\| `[A-Z]+-[0-9]+` / {
      priority=$3; weight=$4
      gsub(/[ `]/, "", priority)
      gsub(/[ `]/, "", weight)
      count += 1
      total += weight
      if (priority == "P0") p0 += weight
    }
    END { print count + 0, total + 0, p0 + 0 }
  ' docs/validation/test-strategy.md
)

if [[ "$scenario_count" != "25" || "$total_weight" != "100" || "$p0_weight" != "92" ]]; then
  echo "FAIL test matrix must contain 25 scenarios totaling 100 points with 92 mandatory P0 points; got count=$scenario_count total=$total_weight p0=$p0_weight" >&2
  exit 1
fi

while IFS=$'\t' read -r link source; do
  target="${link%%#*}"
  [[ -z "$target" ]] && continue
  case "$target" in
    http://*|https://*|mailto:*|/*) continue ;;
  esac
  resolved="$(cd "$(dirname "$source")" && pwd)/$target"
  if [[ ! -e "$resolved" ]]; then
    echo "FAIL broken local Markdown link in $source: $link" >&2
    exit 1
  fi
done < <(
  for source in $(find . \
    \( -path ./.git -o -path '*/node_modules' -o -path '*/dist' -o -path '*/coverage' \) -prune \
    -o -type f -name '*.md' -print | sort); do
    perl -ne 'while (/\[[^]]+\]\(([^)]+)\)/g) { print "$1\n" }' "$source" |
      while IFS= read -r link; do printf '%s\t%s\n' "$link" "$source"; done
  done
)

if rg -n --hidden \
  --glob '!.git/**' \
  --glob '!scripts/validate-repo.sh' \
  '(ctx7sk-|gho_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' .; then
  echo "FAIL probable credential material found" >&2
  exit 1
fi

if find . \
  \( -path ./.git -o -path '*/node_modules' -o -path '*/dist' -o -path '*/coverage' -o -path './.runtime' -o -path './.wrangler' -o -path './.convex' \) -prune \
  -o -type f -size 0 -print | grep -q .; then
  echo "FAIL empty files found" >&2
  find . \
    \( -path ./.git -o -path '*/node_modules' -o -path '*/dist' -o -path '*/coverage' -o -path './.runtime' -o -path './.wrangler' -o -path './.convex' \) -prune \
    -o -type f -size 0 -print >&2
  exit 1
fi

git diff --check

echo "PASS repository structure, skill metadata, bridge, policy, secret, and whitespace checks"

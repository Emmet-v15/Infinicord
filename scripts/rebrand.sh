#!/usr/bin/env bash
# Re-applies the Infinicord rebrand after merging upstream Equibop changes.
# Usage: bash scripts/rebrand.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Applying Infinicord rebrand..."

INCLUDES=(
  --include="*.ts" --include="*.tsx" --include="*.mts" --include="*.mjs"
  --include="*.json" --include="*.html" --include="*.yml" --include="*.yaml"
  --include="*.nsh" --include="*.desktop" --include="*.md"
  --include="*.cc" --include="*.h" --include="*.js"
)
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git)

# Equibop -> Infinicord
grep -rl "equibop\|Equibop\|EQUIBOP" "${INCLUDES[@]}" "${EXCLUDES[@]}" . \
  | xargs sed -i 's/Equibop/Infinicord/g; s/equibop/infinicord/g; s/EQUIBOP/INFINICORD/g'

# Equicord -> Infinicord (skip npm package @equicord/types)
grep -rl "equicord\|Equicord\|EQUICORD" "${INCLUDES[@]}" "${EXCLUDES[@]}" . \
  | xargs sed -i 's/Equicord/Infinicord/g; s/equicord/infinicord/g; s/EQUICORD/INFINICORD/g'

# Restore @equicord/types references (npm package + esbuild external — not ours to rename)
grep -rl "@infinicord/types" --include="*.ts" --include="*.tsx" --include="*.mts" --include="*.mjs" --include="*.json" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  | xargs sed -i 's/@infinicord\/types/@equicord\/types/g'

echo "Done."

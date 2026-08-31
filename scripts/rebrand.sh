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
# Files that legitimately reference the upstream "equicord" token (npm package
# names, regex filters for it, etc.) and must not be rebranded.
SKIP_FILES=(scripts/build/vencordDep.mts)
GREP_SKIP=()
for f in "${SKIP_FILES[@]}"; do GREP_SKIP+=(--exclude="$(basename "$f")"); done

# Equibop -> Infinicord
grep -rl "equibop\|Equibop\|EQUIBOP" "${INCLUDES[@]}" "${EXCLUDES[@]}" . \
  | xargs sed -i 's/Equibop/Infinicord/g; s/equibop/infinicord/g; s/EQUIBOP/INFINICORD/g'

# Equicord -> Infinicord (skip npm package @equicord/types)
grep -rl "equicord\|Equicord\|EQUICORD" "${INCLUDES[@]}" "${EXCLUDES[@]}" "${GREP_SKIP[@]}" . \
  | xargs sed -i 's/Equicord/Infinicord/g; s/equicord/infinicord/g; s/EQUICORD/INFINICORD/g'

# Restore @equicord/types references (npm package + esbuild external — not ours to rename)
grep -rl "@infinicord/types" --include="*.ts" --include="*.tsx" --include="*.mts" --include="*.mjs" --include="*.json" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  | xargs sed -i 's/@infinicord\/types/@equicord\/types/g'

# Restore Equicord/Equicord release URL (plugin asar — named equibop.asar, not ours to rename)
sed -i 's|Infinicord/Infinicord/releases/latest/download/infinicord.asar|Equicord/Equicord/releases/latest/download/equibop.asar|g' src/main/utils/vencordLoader.ts

# Restore equibop/main.js install validation path
sed -i 's|infinicord/main\.js|equibop/main.js|g' src/main/utils/vencordLoader.ts

# Point self-references at the actual repo (Emmet-v15/Infinicord), not a dead Infinicord/Infinicord org
for f in src/main/constants.ts scripts/utils/generateMeta.mts README.md static/views/about.html; do
  [ -f "$f" ] && sed -i 's|github\.com/Infinicord/Infinicord|github.com/Emmet-v15/Infinicord|g' "$f"
done

echo "Done."

#!/usr/bin/env bash
# Re-applies the Infinibop rebrand after merging upstream Equibop changes.
# Usage: bash scripts/rebrand.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Applying Infinibop rebrand..."

grep -rl "equibop\|Equibop\|EQUIBOP" \
  --include="*.ts" --include="*.tsx" --include="*.mts" --include="*.mjs" \
  --include="*.json" --include="*.html" --include="*.yml" --include="*.yaml" \
  --include="*.nsh" --include="*.desktop" --include="*.md" \
  --include="*.cc" --include="*.h" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  . | xargs sed -i 's/Equibop/Infinibop/g; s/equibop/infinibop/g; s/EQUIBOP/INFINIBOP/g'

echo "Done."

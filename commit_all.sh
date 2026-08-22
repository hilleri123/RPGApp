#!/bin/bash
# Commit and push the monorepo (RPGdata / RPGWebMainClient are regular folders).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

MSG="${1:-Описание изменений}"

git add -A
if git diff --cached --quiet; then
  echo "Нечего коммитить"
  exit 0
fi

git commit -m "$MSG"
git push origin HEAD

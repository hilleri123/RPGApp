#!/usr/bin/env bash
# Commit (optional), push master, then pull+deploy on the production VM.
#
# Usage:
#   ./ship-prod.sh "commit message here"   # commit dirty tree, push, deploy
#   ./ship-prod.sh --no-commit             # push current HEAD only, then deploy
#   ./ship-prod.sh --deploy-only           # remote pull+deploy only (no local push)
#
# Env overrides:
#   PROD_HOST=shurik@176.123.165.212
#   PROD_DIR=~/RPGApp
#   PROD_BRANCH=master
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PROD_HOST="${PROD_HOST:-shurik@176.123.165.212}"
PROD_DIR="${PROD_DIR:-~/RPGApp}"
PROD_BRANCH="${PROD_BRANCH:-master}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}warning:${NC} $*" >&2; }
die()  { echo -e "${RED}error:${NC} $*" >&2; exit 1; }

MODE="commit-push-deploy"
COMMIT_MSG=""

usage() {
  cat <<EOF
Usage: $(basename "$0") ["commit message"]
       $(basename "$0") --no-commit
       $(basename "$0") --deploy-only

  Default: if the working tree is dirty, require a commit message, commit,
  fast-forward merge onto ${PROD_BRANCH}, push, then SSH deploy.

  --no-commit     Skip commit; push current ${PROD_BRANCH} and deploy
  --deploy-only   Only SSH to prod, git pull --ff-only, ./deploy.sh --skip-pull

Environment:
  PROD_HOST=${PROD_HOST}
  PROD_DIR=${PROD_DIR}
  PROD_BRANCH=${PROD_BRANCH}
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --no-commit) MODE="push-deploy" ;;
    --deploy-only) MODE="deploy-only" ;;
    -*) die "Unknown flag: $arg (try --help)" ;;
    *)
      if [[ -n "$COMMIT_MSG" ]]; then
        die "Only one commit message allowed"
      fi
      COMMIT_MSG="$arg"
      ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' not found in PATH"
}

require_cmd git
require_cmd ssh

ensure_on_branch() {
  local branch
  branch="$(git branch --show-current)"
  if [[ "$branch" != "$PROD_BRANCH" ]]; then
    log "Checking out ${PROD_BRANCH} (was on ${branch})"
    git checkout "$PROD_BRANCH"
  fi
}

do_commit() {
  if [[ -z "$(git status --porcelain)" ]]; then
    log "Working tree clean — nothing to commit"
    return 0
  fi

  if [[ -z "$COMMIT_MSG" ]]; then
    die "Working tree is dirty. Pass a commit message, or use --no-commit / --deploy-only"
  fi

  log "Staging changes"
  git add -A
  # Keep local scratch / secrets out of the ship commit when present
  git reset HEAD -- \
    'dynamic-scenes (2)/' \
    .env \
    .env.* \
    '*.pem' \
    2>/dev/null || true

  if [[ -z "$(git diff --cached --name-only)" ]]; then
    warn "Nothing staged after exclusions — aborting commit"
    die "No files to commit (only excluded paths changed?)"
  fi

  log "Committing"
  git commit -m "$COMMIT_MSG"
}

do_push() {
  ensure_on_branch
  log "Pushing ${PROD_BRANCH} to origin"
  git push -u origin "$PROD_BRANCH"
  log "Local HEAD: $(git log -1 --oneline)"
}

do_remote_deploy() {
  log "Deploying on ${PROD_HOST}:${PROD_DIR}"
  # Expand ~ on the remote via bash -lc
  ssh -o BatchMode=yes "$PROD_HOST" bash -s -- "$PROD_DIR" "$PROD_BRANCH" <<'REMOTE'
set -euo pipefail
PROD_DIR="$1"
PROD_BRANCH="$2"
cd "$PROD_DIR"
chmod +x deploy.sh
echo "==> Remote: fetching ${PROD_BRANCH}"
git fetch origin "$PROD_BRANCH"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "warning: remote working tree is dirty" >&2
fi
git checkout "$PROD_BRANCH"
git pull origin "$PROD_BRANCH" --ff-only
echo "==> Remote revision: $(git log -1 --oneline)"
./deploy.sh --skip-pull
REMOTE
}

case "$MODE" in
  commit-push-deploy)
    do_commit
    do_push
    do_remote_deploy
    ;;
  push-deploy)
    do_push
    do_remote_deploy
    ;;
  deploy-only)
    do_remote_deploy
    ;;
esac

log "Done"

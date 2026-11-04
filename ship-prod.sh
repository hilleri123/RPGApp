#!/usr/bin/env bash
# Commit (optional), push master, build images on this machine, send them
# to production, then pull and recreate containers there. Production does not build.
#
# Usage:
#   ./ship-prod.sh "commit message here"   # commit dirty tree, push, deploy
#   ./ship-prod.sh --no-commit             # push current HEAD only, then deploy
#   ./ship-prod.sh --deploy-only           # remote pull+deploy only (no local push)
#
# Env overrides:
#   PROD_HOST=shurik@2.26.229.198
#   PROD_DIR=~/RPGApp
#   PROD_BRANCH=master
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PROD_HOST="${PROD_HOST:-shurik@2.26.229.198}"
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

# Built here. migrate and table-asr use the app image.
PROD_IMAGES=(
  rpgzona/app:latest
  rpgzona/web-client:latest
  rpgzona/telegram-bot:latest
  rpgzona/table-bridge:latest
)

do_local_images() {
  require_cmd docker
  # Эти переменные нужны только чтобы compose разобрал файл. В образ они не
  # попадают: это не build-args, а окружение уже запущенного контейнера.
  export RABBIT_URL="${RABBIT_URL:-amqp://user:pass@rabbitmq:5672/}"
  export RABBITMQ_DEFAULT_USER="${RABBITMQ_DEFAULT_USER:-user}"
  export RABBITMQ_DEFAULT_PASS="${RABBITMQ_DEFAULT_PASS:-pass}"
  log "Building images on this machine"
  docker compose -f compose.prod.yml build app web-client telegram-bot table-bridge
  log "Sending images to ${PROD_HOST}"
  docker save "${PROD_IMAGES[@]}" | gzip -1 | ssh -o BatchMode=yes "$PROD_HOST" 'gunzip | docker load'
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
    do_local_images
    do_remote_deploy
    ;;
  push-deploy)
    do_push
    do_local_images
    do_remote_deploy
    ;;
  deploy-only)
    do_remote_deploy
    ;;
esac

log "Done"

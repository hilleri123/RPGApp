#!/usr/bin/env bash
# Pull master (root + submodules) and deploy production with Alembic migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="compose.prod.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE")
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$ROOT" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_-')}"
MIGRATE_CONTAINER="${PROJECT_NAME}-migrate-1"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SKIP_PULL=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [--skip-pull]

  --skip-pull   Skip git pull (redeploy current checkout only)

Pulls origin/master, updates submodules, builds images, runs Alembic
via the migrate service, then recreates app / web-client / telegram-bot.
EOF
}

log()  { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}warning:${NC} $*" >&2; }
die()  { echo -e "${RED}error:${NC} $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --skip-pull) SKIP_PULL=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $arg (try --help)" ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' not found in PATH"
}

check_env_file() {
  [[ -f .env ]] || die ".env missing — copy from .env.example and fill in values"

  # shellcheck disable=SC1091
  set -a
  source .env
  set +a

  local missing=()
  for var in POSTGRES_PASSWORD SECRET_KEY BOT_TOKEN RABBIT_URL RABBITMQ_DEFAULT_USER RABBITMQ_DEFAULT_PASS; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done

  if ((${#missing[@]} > 0)); then
    die "Missing required .env variables: ${missing[*]}"
  fi
}

pull_master() {
  log "Fetching and checking out master"
  git fetch origin master

  if [[ -n "$(git status --porcelain)" ]]; then
    warn "Working tree has uncommitted changes — pull may fail or leave dirty submodules"
  fi

  git checkout master
  git pull origin master

  log "Updating submodules to commits pinned in master"
  git submodule update --init --recursive

  log "Current revision: $(git log -1 --oneline)"
  git submodule status
}

build_and_deploy() {
  log "Building images"
  "${COMPOSE[@]}" build app web-client telegram-bot migrate

  log "Running Alembic migrations (migrate service)"
  # Force-recreate so migrate always uses the freshly built image (not a stale container).
  "${COMPOSE[@]}" up -d --force-recreate --no-deps db
  "${COMPOSE[@]}" up --build --force-recreate --abort-on-container-exit migrate

  verify_migrate

  log "Starting / recreating application services"
  "${COMPOSE[@]}" up -d --force-recreate app web-client telegram-bot

  log "Ensuring infrastructure services are up"
  "${COMPOSE[@]}" up -d db redis rabbitmq pg-backup
}

verify_migrate() {
  if ! docker inspect "$MIGRATE_CONTAINER" >/dev/null 2>&1; then
    die "Migrate container '$MIGRATE_CONTAINER' not found"
  fi

  local status exit_code
  status="$(docker inspect -f '{{.State.Status}}' "$MIGRATE_CONTAINER")"
  exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$MIGRATE_CONTAINER")"

  if [[ "$status" != "exited" ]] || [[ "$exit_code" != "0" ]]; then
    echo -e "${RED}=== migrate logs (last 40 lines) ===${NC}" >&2
    docker logs "$MIGRATE_CONTAINER" 2>&1 | tail -40 >&2 || true
    die "migrate failed (status=$status, exit=$exit_code)"
  fi

  if docker logs "$MIGRATE_CONTAINER" 2>&1 | grep -q "Running upgrade"; then
    log "New migrations were applied"
    docker logs "$MIGRATE_CONTAINER" 2>&1 | grep "Running upgrade" || true
  else
    log "Database schema already at head (no new migrations)"
  fi
}

wait_for_healthy() {
  local service="$1" attempts="${2:-30}" i
  for ((i = 1; i <= attempts; i++)); do
    if "${COMPOSE[@]}" ps "$service" 2>/dev/null | grep -q "(healthy)"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

verify_runtime() {
  log "Waiting for app healthcheck"
  wait_for_healthy app 45 || warn "app healthcheck not green yet — check logs"

  if docker exec "${PROJECT_NAME}-app-1" alembic current 2>/dev/null | tail -1; then
    :
  else
    warn "Could not read alembic current from app container"
  fi

  local api_code web_code
  api_code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:6601/health || echo '000')"
  web_code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:6602/ || echo '000')"

  log "HTTP checks: API /health=$api_code, web=$web_code"
  if [[ "$api_code" != "200" ]] || [[ "$web_code" != "200" ]]; then
    warn "One or more endpoints did not return 200 — inspect: ${COMPOSE[*]} ps && ${COMPOSE[*]} logs app web-client"
  fi

  "${COMPOSE[@]}" ps
}

main() {
  require_cmd git
  require_cmd docker
  require_cmd curl

  check_env_file

  if ((SKIP_PULL == 0)); then
    pull_master
  else
    log "Skipping git pull (--skip-pull)"
    git submodule update --init --recursive
  fi

  build_and_deploy
  verify_runtime

  log "Deploy finished"
}

main "$@"

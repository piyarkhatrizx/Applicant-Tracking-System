#!/usr/bin/env bash
#
# Korosha: one command to get from a cold checkout to a working page.
#
#   npm run go
#
# Installs if needed, starts the dev server, waits until the app
# actually answers, opens a browser, and tears everything down on Ctrl C.
#
# Configuration:
#   KOROSHA_PORT     port to serve on            (default 3000)
#   KOROSHA_URL      URL to poll and open        (default http://localhost:PORT)
#   KOROSHA_TIMEOUT  seconds to wait for boot    (default 90)
#   KOROSHA_NO_OPEN  set to 1 to skip the browser

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PORT="${KOROSHA_PORT:-3000}"
URL="${KOROSHA_URL:-http://localhost:${PORT}}"
TIMEOUT="${KOROSHA_TIMEOUT:-90}"

# Colors, but only when attached to a terminal.
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; PURPLE=$'\033[35m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; PURPLE=""; RESET=""
fi

say()  { printf "%s\n" "${PURPLE}▸${RESET} $*"; }
ok()   { printf "%s\n" "${GREEN}✓${RESET} $*"; }
die()  { printf "\n%s\n\n" "${RED}✗ $*${RESET}" >&2; exit 1; }

DEV_PID=""
TAIL_PID=""
LOG_FILE=""

# ---------------------------------------------------------------------------
# Teardown. Runs on Ctrl C, on error, and on normal exit.
#
# `next dev` spawns children, so killing only the PID we started orphans them
# and leaves the port held. Job control (set -m) puts the server in its own
# process group, and the negative PID signals the whole group.
# ---------------------------------------------------------------------------
cleanup() {
  local code=$?
  trap - EXIT INT TERM

  if [ -n "$TAIL_PID" ] && kill -0 "$TAIL_PID" 2>/dev/null; then
    kill -TERM "$TAIL_PID" 2>/dev/null || true
  fi

  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    printf "\n%s\n" "${DIM}Stopping dev server…${RESET}"
    kill -TERM "-${DEV_PID}" 2>/dev/null || kill -TERM "$DEV_PID" 2>/dev/null || true

    # Give it a moment to exit cleanly, then insist.
    for _ in $(seq 1 20); do
      kill -0 "$DEV_PID" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$DEV_PID" 2>/dev/null; then
      kill -KILL "-${DEV_PID}" 2>/dev/null || kill -KILL "$DEV_PID" 2>/dev/null || true
    fi
  fi

  [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ] && rm -f "$LOG_FILE"
  exit "$code"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || die "node is not installed."
command -v npm  >/dev/null 2>&1 || die "npm is not installed."

port_holder() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1" (pid "$2")"}'
  fi
}

if holder="$(port_holder)" && [ -n "$holder" ]; then
  die "Port ${PORT} is already in use by ${holder}.
  Stop it, or run on another port:  KOROSHA_PORT=3001 npm run go"
fi

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
if [ ! -d node_modules ]; then
  say "Installing dependencies (first run)…"
  npm install --silent || die "npm install failed."
  ok "Dependencies installed"
fi

# ---------------------------------------------------------------------------
# Start the server in its own process group
# ---------------------------------------------------------------------------
LOG_FILE="$(mktemp -t korosha-dev.XXXXXX)"
say "Starting Korosha on port ${PORT}…"

set -m
npx next dev --port "$PORT" >"$LOG_FILE" 2>&1 &
DEV_PID=$!
set +m

# ---------------------------------------------------------------------------
# Poll until the app actually answers. Not a sleep: a slow first compile is
# normal and a fixed delay either wastes time or opens a dead tab.
# ---------------------------------------------------------------------------
say "Waiting for the app to respond…"
deadline=$(( $(date +%s) + TIMEOUT ))
ready=""

while [ "$(date +%s)" -lt "$deadline" ]; do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    printf "\n%s\n" "${DIM}--- dev server output ---${RESET}" >&2
    tail -30 "$LOG_FILE" >&2
    die "The dev server exited before it came up."
  fi

  # Any HTTP response means Next is serving, so 2xx/3xx/4xx all count as "up".
  if curl -sS -o /dev/null --max-time 3 "$URL" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 0.5
done

if [ -z "$ready" ]; then
  printf "\n%s\n" "${DIM}--- dev server output ---${RESET}" >&2
  tail -30 "$LOG_FILE" >&2
  die "App did not respond at ${URL} within ${TIMEOUT}s.
  Raise the limit with KOROSHA_TIMEOUT=180 npm run go"
fi

ok "Korosha is up at ${BOLD}${URL}${RESET}"

# ---------------------------------------------------------------------------
# Open a browser
# ---------------------------------------------------------------------------
open_browser() {
  case "$(uname -s)" in
    Darwin)                 open "$URL" >/dev/null 2>&1 ;;
    Linux)                  command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 ;;
    CYGWIN*|MINGW*|MSYS*)   start "" "$URL" >/dev/null 2>&1 || cmd.exe /c start "" "$URL" >/dev/null 2>&1 ;;
    *)                      return 1 ;;
  esac
}

if [ "${KOROSHA_NO_OPEN:-0}" = "1" ]; then
  printf "%s\n" "${DIM}Browser not opened (KOROSHA_NO_OPEN=1).${RESET}"
elif open_browser; then
  ok "Opened in your browser"
else
  printf "%s\n" "${DIM}Could not open a browser automatically. Visit ${URL}${RESET}"
fi

printf "\n%s\n\n" "${DIM}Ctrl C to stop.${RESET}"

# Stream the server's output for the rest of the session.
tail -f "$LOG_FILE" &
TAIL_PID=$!

# Poll rather than `wait`. A trap set on INT does not reliably interrupt a
# blocking `wait` in a non-interactive shell — the handler runs only once the
# builtin returns, so Ctrl C left the server running and the port held. Traps
# fire dependably between commands, so a sleep loop is what makes teardown work.
while kill -0 "$DEV_PID" 2>/dev/null; do
  sleep 0.5
done

#!/usr/bin/env bash
# Golden byte-diff: the v12 (pino) legacy output must be byte-identical to the published
# winston-based v11 for every parity shape, after timestamp normalisation.
set -euo pipefail

BASELINE_VERSION="${CSL_GOLDEN_BASELINE:-11.10.6}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "== installing baseline @mojaloop/central-services-logger@${BASELINE_VERSION}"
(cd "$WORK" && npm init -y >/dev/null 2>&1 && npm i "@mojaloop/central-services-logger@${BASELINE_VERSION}" --no-audit --no-fund >/dev/null 2>&1)
BASELINE="$WORK/node_modules/@mojaloop/central-services-logger"

normalise () { sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z/TS/g'; }

run_fixture () { # $1 = csl path, $2 = out file, remaining = extra env
  local csl="$1" out="$2"; shift 2
  (cd "$WORK" && env CSL_PATH="$csl" "$@" node "$REPO/test/golden/fixture.js" 2>/dev/null | normalise > "$out")
}

fail=0
for variant in "default:" "filter:LOG_FILTER=error, warn" "spacing:CSL_JSON_STRINGIFY_SPACING=2" "suppress:CSL_EXPECTED_ERROR_LEVEL=false"; do
  name="${variant%%:*}"; envkv="${variant#*:}"
  extra=()
  [ -n "$envkv" ] && extra=("$envkv")
  run_fixture "$BASELINE" "$WORK/v11-$name.out" "${extra[@]+"${extra[@]}"}"
  run_fixture "$REPO" "$WORK/v12-$name.out" "${extra[@]+"${extra[@]}"}"
  if diff -u "$WORK/v11-$name.out" "$WORK/v12-$name.out" > "$WORK/diff-$name.txt"; then
    echo "== [$name] GOLDEN DIFF EMPTY ($(wc -l < "$WORK/v12-$name.out" | tr -d ' ') lines byte-exact)"
  else
    echo "== [$name] GOLDEN DIFF FAILED:"; cat "$WORK/diff-$name.txt"; fail=1
  fi
done

echo "== crash parity"
set +e
(cd "$WORK" && env CSL_PATH="$BASELINE" node "$REPO/test/golden/crash.js" >"$WORK/crash-v11.out" 2>/dev/null); s11=$?
(cd "$WORK" && env CSL_PATH="$REPO" node "$REPO/test/golden/crash.js" >"$WORK/crash-v12.out" 2>/dev/null); s12=$?
set -e
c11=$(grep -c 'uncaughtException: crash-test' "$WORK/crash-v11.out" || true)
c12=$(grep -c 'uncaughtException: crash-test' "$WORK/crash-v12.out" || true)
grep -q SURVIVED "$WORK/crash-v11.out" && grep -q SURVIVED "$WORK/crash-v12.out" || { echo "crash: SURVIVED missing"; fail=1; }
[ "$s11" = 0 ] && [ "$s12" = 0 ] || { echo "crash: exit codes v11=$s11 v12=$s12 (both must be 0)"; fail=1; }
[ "$c12" = 1 ] || { echo "crash: v12 must log the exception exactly once (got $c12)"; fail=1; }
echo "== crash: exit v11=$s11 v12=$s12, exception lines v11=$c11 v12=$c12 (v11's extra 'undefined' line is a fixed defect)"

[ "$fail" = 0 ] && echo "== GOLDEN: PASS" || { echo "== GOLDEN: FAIL"; exit 1; }

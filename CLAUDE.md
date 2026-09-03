# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the central-services-logger library (csl), the shared logging library for Mojaloop components. Since v12 it is built on **pino** behind a compatibility wrapper that preserves the historical winston-era surface; the default (`legacy`) output format is byte-identical to v11, and `CSL_LOG_FORMAT=json` switches to structured one-line JSON.

## Architecture (v12)

One pipeline, one pino engine, gating and formatting owned by the wrapper:

- `src/index.js` — exports the singleton `createMlLogger()` root.
- `src/MlLogger.js` — the wrapper class. Level methods live on the **prototype**; children are `Object.create(parent)` (spies/stubs on a parent are visible through children — winston parity). `is*Enabled` are **writable own boolean data properties**. Internal state is under **Symbols — never convert to `#` private fields** (children never run the constructor; `#`-field access through the prototype chain throws). pino's own level is pinned at `silly`; the wrapper is the gate (`LOG_FILTER` ∧ level/transport-level ∧ `silent`). The pino metadata sink (`Symbol.for('pino.metadata')`) receives the original objects and renders the legacy line without re-parsing JSON. **No pino children are ever created** — child bindings are merged per call by the wrapper (pino serialises chindings to strings, which would break the legacy renderer).
- `src/lib/args.js` — normalises every call shape (`(msg)`, `(msg, meta)`, `(msg, Error)`, bare Error, single object, printf tokens) to `{ message, meta }` with measured v11 parity.
- `src/lib/redact.js` — `redactDeep`, clone-on-read redaction equivalent to the v11 stringify replacer (cycle-safe); runs BEFORE pino so JSON output and OTel log-sending never see secrets.
- `src/lib/errorExpect.js` — OTel-baggage expected-error re-level/suppression; reads `config.expectedErrorLevel` on every call (tests mutate it).
- `src/lib/legacyFormat.js` — byte-exact legacy line renderer (measured ANSI table; colours are always on, as logform forced them).
- `src/lib/transports.js` — console (`process.stdout.write` per call — tests spy it), file (`pino.destination({sync:true,mkdir:true})`, shared per filename), udp descriptors.
- `src/lib/exceptionHandler.js` — ONE process-wide `uncaughtException` listener (log-and-continue, winston `exitOnError:false` parity); the `globalThis[Symbol.for('csl.exceptionHandler')]` slot is a mutable box re-pointed by every `createMlLogger()` so the last-created root handles crashes. Opt out: `CSL_HANDLE_EXCEPTIONS=false`.
- `src/contextLogger.js` — `ContextLogger`/`loggerFactory`/`asyncStorage`; unchanged public API (deep-imported by sdk-standard-components, which subclasses it — `mlLogger`, `context`, `createContext()`, `(context, {mlLogger})` ctor are de-facto public).
- `src/lib/constants.js` — `allLevels` keeps the winston numbers/order (deep-imported by sdk-standard-components; DO NOT change), `LEVEL_VALUES` is the pino scale.

## Compatibility contract (do not break)

Deep-import paths `src/contextLogger`, `src/lib/constants`, `src/lib/config` are public API. The default export must keep: prototype level methods, writable own `is*Enabled` booleans, `child`/`push` (deprecated alias)/`log`, `level`/`silent` setters, the `transports` descriptor shim, and jest-automock/sinon-stub friendliness. `npm run test:golden` diffs this implementation byte-for-byte against the published v11 — it must stay empty.

## Common Development Commands

```bash
nvm use              # Node version from .nvmrc
npm test             # standard lint + full jest suite
npm run test:unit    # jest, test/unit only
npm run test:coverage # jest with 90% global thresholds
npm run test:golden  # byte-diff legacy output vs published v11 (network: installs the baseline)
npm run bench        # micro-benchmark v11 vs v12-legacy vs v12-json (evidence for mojaloop/project#3621)
npm run lint         # standard
```

## Configuration

Via `rc` with prefix `CSL_` (see `config/default.json`); bare `LOG_LEVEL`/`LOG_FILTER` are honoured for backwards compatibility. Keys: `LOG_LEVEL`, `LOG_FILTER` (whitelist of level names; since v12 also reflected in `is*Enabled`), `LOG_TRANSPORT` (`console` | `file` | JSON map with `transport`/`type` of console/file/udp), `TRANSPORT_FILE_OPTIONS`, `LOG_FORMAT` (`legacy`|`json` — `CSL_LOG_FORMAT` only, no bare alias), `JSON_STRINGIFY_SPACING`, `EXPECTED_ERROR_LEVEL`, `HANDLE_EXCEPTIONS`. Config is read at require time; `expectedErrorLevel` is read per call.

## Testing Approach

Jest 30 only (`test/unit/**`, `test/jest/**`), coverage 90% global. `test/golden/` is the cross-version byte-diff harness (not part of jest). `test/perf/bench.js` is the micro-benchmark. The OTel suite (`contextLogger.otel.test.js`) loads `@opentelemetry/auto-instrumentations-node/register`; `instrumentation-pino` injects `trace_id`/`span_id` via mixin and its log-sending multistream wrap is covered by a spawn test in `processIntegration.test.js`.

## Releases

CircleCI orb (`mojaloop/build`) + standard-version. Channel branches `^(major|minor|patch)/<id>$` publish prereleases on every green **branch push** (e.g. `major/pino` → `12.0.0-pino.N` on dist-tag `major-pino`); CI pushes a `chore(release)` commit + tag back, so channel branches are append-only — pull after each publish, never force-push.

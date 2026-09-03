# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the central-services-logger library (csl), the shared logging library for Mojaloop components. This branch (d3/pino-native) is the **pino-native max-performance build**: json-only output, async buffered writes by default, pino-native child loggers (chindings), Errors via pino's `err` serializer. The historical csl API surface is preserved; the winston-era OUTPUT format is not.

## Architecture (pino-native)

One pipeline, one pino engine, gating and formatting owned by the wrapper:

- `src/index.js` — exports the singleton `createMlLogger()` root.
- `src/MlLogger.js` — the wrapper class. Level methods live on the **prototype**; children are `Object.create(parent)` (spies/stubs on a parent are visible through children — winston parity). `is*Enabled` are **writable own boolean data properties**. Internal state is under **Symbols — never convert to `#` private fields** (children never run the constructor; `#`-field access through the prototype chain throws). The wrapper is the gate (`LOG_FILTER` ∧ level ∧ `silent`). pino writes STRAIGHT to the destination (no metadata sink, no renderer). **Children are pino-native**: `child(bindings)` redacts once and creates a real pino child (chindings serialise once). pino's own level stays pinned at `silly` because pino children snapshot their level methods at creation — family-wide `setLevel` needs the wrapper gate.
- `src/lib/redact.js` — `redactDeep`, clone-on-read redaction equivalent to the v11 stringify replacer (cycle-safe); runs BEFORE pino so JSON output and OTel log-sending never see secrets.
- `src/lib/errorExpect.js` — OTel-baggage expected-error re-level/suppression, invoked from ContextLogger (the layer that knows the context; in this build context travels in chindings, not meta).
- `src/lib/transports.js` — `createDestination`: console (async sonic fd1 by default; `CSL_LOG_SYNC=true` = per-line `process.stdout.write` for stdout spies), file (`pino.destination`), udp (json lines over UDP); multi-transport via `pino.multistream` with native per-transport levels.
- `src/lib/exceptionHandler.js` — ONE process-wide `uncaughtException` listener (log-and-continue, winston `exitOnError:false` parity); the `globalThis[Symbol.for('csl.exceptionHandler')]` slot is a mutable box re-pointed by every `createMlLogger()` so the last-created root handles crashes. Opt out: `CSL_HANDLE_EXCEPTIONS=false`.
- `src/contextLogger.js` — `ContextLogger`/`loggerFactory`/`asyncStorage`; unchanged public API (deep-imported by sdk-standard-components, which subclasses it — `mlLogger`, `context`, `createContext()`, `(context, {mlLogger})` ctor are de-facto public).
- `src/lib/constants.js` — `allLevels` keeps the winston numbers/order (deep-imported by sdk-standard-components; DO NOT change), `LEVEL_VALUES` is the pino scale.

## Compatibility contract (do not break)

Deep-import paths `src/contextLogger`, `src/lib/constants`, `src/lib/config` are public API. The default export must keep: prototype level methods, writable own `is*Enabled` booleans, `child`/`push` (deprecated alias)/`log`, `level`/`silent` setters, the `transports` descriptor shim, and jest-automock/sinon-stub friendliness. There is NO golden gate on this branch — output compatibility with v11 is intentionally dropped; the API contract above still holds.

## Common Development Commands

```bash
nvm use              # Node version from .nvmrc
npm test             # standard lint + full jest suite
npm run test:unit    # jest, test/unit only
npm run test:coverage # jest with 90% global thresholds
npm run bench        # v11 | d1-json | d2-json-async | d3-sync | d3 | raw-pino ceiling
npm run lint         # standard
```

## Configuration

Via `rc` with prefix `CSL_` (see `config/default.json`); bare `LOG_LEVEL`/`LOG_FILTER` are honoured for backwards compatibility. Keys: `LOG_LEVEL`, `LOG_FILTER` (whitelist of level names; since v12 also reflected in `is*Enabled`), `LOG_TRANSPORT` (`console` | `file` | JSON map with `transport`/`type` of console/file/udp), `TRANSPORT_FILE_OPTIONS`, `LOG_FORMAT` (json-only in this build), `JSON_STRINGIFY_SPACING`, `EXPECTED_ERROR_LEVEL`, `HANDLE_EXCEPTIONS`. Config is read at require time; `expectedErrorLevel` is read per call.

## Testing Approach

Jest 30 only (`test/unit/**`, `test/jest/**`), coverage 90% global. `test/perf/bench.js` is the micro-benchmark (no golden harness on this branch). The OTel suite (`contextLogger.otel.test.js`) loads `@opentelemetry/auto-instrumentations-node/register`; `instrumentation-pino` injects `trace_id`/`span_id` via mixin and its log-sending multistream wrap is covered by a spawn test in `processIntegration.test.js`.

## Releases

CircleCI orb (`mojaloop/build`) + standard-version. Channel branches `^(major|minor|patch)/<id>$` publish prereleases on every green **branch push** (e.g. `major/pino` → `12.0.0-pino.N` on dist-tag `major-pino`); CI pushes a `chore(release)` commit + tag back, so channel branches are append-only — pull after each publish, never force-push.

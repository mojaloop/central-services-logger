# central-services-logger
[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/central-services-logger.svg?style=flat)](https://github.com/mojaloop/central-services-logger/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/central-services-logger.svg?style=flat)](https://github.com/mojaloop/central-services-logger/releases)
[![CircleCI](https://circleci.com/gh/mojaloop/central-services-logger.svg?style=svg)](https://circleci.com/gh/mojaloop/central-services-logger)

Common shared Logging lib for Mojaloop components, backed by [pino](https://github.com/pinojs/pino).

**This is the pino-native (max-performance) build**: structured one-line JSON is the only output format, asynchronous buffered writes are the default, child/context bindings use pino-native chindings, and Errors render through pino's standard `err` serializer. It is NOT output-compatible with the winston-era (≤ v11) line format or with the pino-compatible build's legacy mode.

## Configuration

<!-- Set the following environment variable `LOG_LEVEL` to the desired log level (i.e. `info`, `debug` etc. - _Note: This must be lower-case._) -->

Edit the file in `./config/default.json` to configure the logger, or set the following Environment variables:

| Environment variable | Description | Default | Available Values |
| --- | --- | --- | --- |
| `LOG_LEVEL` | Also `CSL_LOG_LEVEL` | `info` | `error`, `warn`, `audit`, `trace`, `info`, `perf`, `verbose`, `debug`, `silly` |
| `CSL_LOG_LEVEL` | Sets the log level | `info` | `error`, `warn`, `audit`, `trace`, `info`, `perf`, `verbose`, `debug`, `silly` |
| `LOG_FILTER` | Also `CSL_LOG_FILTER` | `""` | e.g. `"error, trace, verbose" |
| `CSL_LOG_FILTER` | Applies a log filter. Specify a comma separated list of individual log levels to be included instead of specifying a `LOG_LEVEL` | `""` | e.g. `"error, trace, verbose" |
| `CSL_LOG_TRANSPORT` | Selects the transport method. Either `console`, `file` or a map for multiple transports. Uses the same transport for errors and standard logs | `console` | `console`, `file`, `{}` |
| `CSL_TRANSPORT_FILE_OPTIONS` | _Optional._ Required if `LOG_TRANSPORT=file`. `filename` is mandatory; an optional `level` restricts the transport; legacy winston-era keys are ignored | See `default.json` | `{ "filename": "logs/combined.log" }` |
| `CSL_LOG_FORMAT` | Accepted for compatibility; json is the only format in this build (anything else warns and uses json) | `json` | `json` |
| `CSL_LOG_SYNC` | Asynchronous buffered writes are the DEFAULT (sonic-boom, 4KB buffer, periodic + on-exit flush; `Logger.flush()` drains on demand; a direct signal kill without a shutdown handler can lose the buffered tail). Set `true` for per-line synchronous `process.stdout.write` (e.g. tests that spy stdout) | `false` | `true`, `false` |
| `CSL_JSON_STRINGIFY_SPACING` |  _Optional._  A number that's used to insert white space into the output JSON string for readability purposes. | 0 | integer
| `EXPECTED_ERROR_LEVEL` | Set log level for expected errors or turn off logging them when `false` | `info` | Log levels, `false` |
| `CSL_HANDLE_EXCEPTIONS` | Log uncaught exceptions through the logger and keep the process running (pre-v12 parity). Set to `false` to restore Node's default crash behaviour | `true` | `true`, `false` |

### Configuring multiple transports

The `CSL_LOG_TRANSPORT` environment variable can be set to a JSON object to
configure multiple transports. The key names can be any string, and the values
should be objects that contain the transport type and configuration, e.g.:

```json
{
  "stdout": {
    "type": "console"
  },
  "fluentbit": {
    "type": "udp",
    "host": "fluentbit"
  },
  "combined": {
    "type": "file",
    "filename": "combined.log"
  }
}
```

### UDP Transport

The `udp` transport is a custom transport that sends logs to a remote server
via UDP. The following configuration options are available:

| Option     | Description                                     | Default   | Required |
| ---        | ---                                             | ---       | ---      |
| `host`     | The hostname or IP address of the remote server | localhost | No       |
| `port`     | The port number of the remote server            | 5170      | No       |
| `mtu`      | The maximum size of a single packet in bytes    | 1400      | No       |
| `max`      | The maximum size of logged message              | 4096      | No       |
| `id`       | Optional id to put in front of each packet      | false     | No       |

- Messages above the `max` size will not be sent.
- `id` is useful for identifying the source of the logs on the remote server.
  It can be set to `true` to generate a random id, or a hex string to use a
  specific id.
- `mtu` should be set to the maximum packet size that the network can handle.
  Messages that are too large will be split into multiple network packets.

## Usage

### Logger

To use the shared Logger class, you only need to require it in the file you want to perform logging in:

```javascript
const Logger = require('@mojaloop/central-services-logger')
```

Then you simply need to call the appropriate method for the logging level you desire:

```javascript
Logger.debug('this is only a debug statement')
Logger.info('this is some info')
Logger.warn('warning')
Logger.error('an error has occurred')
```

The Logger is backed by [pino](https://github.com/pinojs/pino) behind a compatibility wrapper that keeps the historical csl surface: printf-style interpolation, `(message, meta)` structured calls, bare `Error` arguments, `Logger.log(level, ...)`, `Logger.child(bindings)` and the `is<Level>Enabled` guard flags all work:

```javascript
Logger.info('test message %s', 'my string')
Logger.info('transfer prepared', { transferId, payerFsp })
Logger.error('request failed', err) // enumerable props + stack land in the context blob
Logger.isDebugEnabled && Logger.debug(`payload: ${JSON.stringify(payload)}`)
```

By default, the Logger logs to the console only, with timestamps and colorized output. Sensitive keys and values (tokens, secrets, PEM/JWT material, ...) are redacted before a record reaches any transport or OpenTelemetry log exporter.

### pino-native build: output differences vs the pino-compatible build

* json is the only format; the legacy line renderer and the byte-exact golden gate are removed.
* Context/bindings serialise once as pino chindings (fastest); call meta layers on top (duplicate keys are pino-native: last one wins on parse — avoid `level`/`time`/`message` keys in meta).
* Errors nest under the `err` key via pino's standard serializer (`type`/`message`/`stack` + enumerables + cause chain); messages are no longer appended with `err.message`.
* Expected-error (OTel baggage) handling lives in `ContextLogger` (the layer that knows the context).
* Per-transport runtime `level`/`silent` mutation is gone (multistream handles per-transport levels at construction); use `Logger.level` / `Logger.silent`.

### v12 behaviour changes (winston → pino)

The default (legacy) output is byte-identical to v11 — enforced by `npm run test:golden`, which diffs this implementation against the published v11 on a fixture corpus. Deliberate changes, all fixes of v11 defects:

* `Logger.error(err)` (bare Error) logs `err.message` plus stack/enumerables — v11 printed `undefined` and dropped the stack.
* `Logger.info(obj)` without a `message` key logs the object as context — v11 printed `[object Object]`.
* printf tokens (`%s %d %j %o`) now interpolate and a trailing object becomes meta — v11 silently dropped the extra arguments. Audit call sites that pass payloads via `%s`: prefer `(msg, { payload })` so key-based redaction applies.
* `LOG_TRANSPORT=file` writes real formatted lines — v11 wrote literal `undefined` lines.
* Uncaught exceptions are logged once through one process-wide handler — v11 logged them twice (second line literally `undefined`) and leaked one listener per `loggerFactory()` call.
* `is<Level>Enabled` / `isLevelEnabled()` now honour `LOG_FILTER` and runtime level changes; `Logger.log()` honours `LOG_FILTER` too.
* `meta.timestamp` no longer replaces the line timestamp (it is dropped); an invalid `LOG_LEVEL` falls back to `info` with a warning.
* Redaction and expected-error suppression apply to **all** transports — in v11 both were console-only, so UDP/file records were unredacted.
* `Logger.transports` is a deprecated compatibility shim (descriptors with `name`/`level`/`silent`), not winston transport instances; use `Logger.level = '<level>'` and `Logger.silent = true` instead.
* The TypeScript type of the default export is a csl-owned interface (winston types are gone).

## Auditing Dependencies

We use `audit-ci` along with `npm audit` to check dependencies for node vulnerabilities, and keep track of resolved dependencies with an `audit-ci.jsonc` file.

To start a new resolution process, run:

```bash
npm run audit:fix
```

You can then check to see if the CI will pass based on the current dependencies with:

```bash
npm run audit:check
```

The [audit-ci.jsonc](./audit-ci.jsonc) contains any audit-exceptions that cannot be fixed to ensure that CircleCI will build correctly.

## Contextual Logging

If you need contextual logging, an context object can be passed using Logger.child({'context': {a:1}}).info("Message").

```bash
Output: timestamp - info: {
  a: 1,
  message: 'Message'
}
```

## Automated Releases

As part of our CI/CD process, we use a combination of CircleCI, standard-version
npm package and github-release CircleCI orb to automatically trigger our releases
and image builds. This process essentially mimics a manual tag and release.

On a merge to master, CircleCI is configured to use the mojaloopci github account
to push the latest generated CHANGELOG and package version number.

Once those changes are pushed, CircleCI will pull the updated master, tag and
push a release triggering another subsequent build that also publishes a docker image.

### Potential problems

* There is a case where the merge to master workflow will resolve successfully, triggering
  a release. Then that tagged release workflow subsequently failing due to the image scan,
  audit check, vulnerability check or other "live" checks.

  This will leave master without an associated published build. Fixes that require
  a new merge will essentially cause a skip in version number or require a clean up
  of the master branch to the commit before the CHANGELOG and bump.

  This may be resolved by relying solely on the previous checks of the
  merge to master workflow to assume that our tagged release is of sound quality.
  We are still mulling over this solution since catching bugs/vulnerabilities/etc earlier
  is a boon.

* It is unknown if a race condition might occur with multiple merges with master in
  quick succession, but this is a suspected edge case.

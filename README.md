# central-services-logger
[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/central-services-logger.svg?style=flat)](https://github.com/mojaloop/central-services-logger/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/central-services-logger.svg?style=flat)](https://github.com/mojaloop/central-services-logger/releases)
[![CircleCI](https://circleci.com/gh/mojaloop/central-services-logger.svg?style=svg)](https://circleci.com/gh/mojaloop/central-services-logger)

Common shared Logging lib for Mojaloop components

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
| `CSL_TRANSPORT_FILE_OPTIONS` | _Optional._ Required if `LOG_TRANSPORT=file`. Configures the winston file transport | See `default.json` | See the [Winston Docs](https://github.com/winstonjs/winston#common-transport-options) |
| `CSL_JSON_STRINGIFY_SPACING` |  _Optional._  A number that's used to insert white space into the output JSON string for readability purposes. | 2 | integer
| `EXPECTED_ERROR_LEVEL` | Set log level for expected errors or turn off console logging when `false` | `info` | Log levels, `false` |

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

The Logger class is backed by [Winston](https://github.com/winstonjs/winston), which allows you to do things like [string interpolation](https://github.com/winstonjs/winston#string-interpolation):

```javascript
Logger.info('test message %s', 'my string');
```

You can also call the Logger.log method which directly calls the Winston log method and gives even more flexibility.

By default, the Logger class is setup to log to the console only, with timestamps and colorized output.

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

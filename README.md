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
| `LOG_LEVEL` | _deprecated_ Use `CSL_LOG_LEVEL` instead | `info` | `error`, `warn`, `audit`, `trace`, `info`, `perf`, `verbose`, `debug`, `silly` |
| `CSL_LOG_LEVEL` | Sets the log level | `info` | `error`, `warn`, `audit`, `trace`, `info`, `perf`, `verbose`, `debug`, `silly` |
| `LOG_FILTER` | _deprecated_ Use `CSL_LOG_FILTER` instead | `""` | e.g. `"error, trace, verbose" | 
| `CSL_LOG_FILTER` | Applies a log filter. Specify a comma separated list of individual log levels to be included instead of specifying a `LOG_LEVEL` | `""` | e.g. `"error, trace, verbose" |
| `CSL_LOG_TRANSPORT` | Selects the transport method. Either `console` or `file` | `file` | `console`, `file`
| `CSL_TRANSPORT_FILE_OPTIONS` | _Optional._ Required if `LOG_TRANSPORT=file`. Configures the winston file transport | See `default.json` | See the [Winston Docs](https://github.com/winstonjs/winston#common-transport-options) |




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

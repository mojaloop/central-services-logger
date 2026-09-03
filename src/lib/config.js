const RC = require('parse-strings-in-object')(require('rc')('CSL', require('../../config/default.json')))

const Config = {
  // note: We maintain the LOG_LEVEL and LOG_FILTER env variable here to ensure backwards compatibility to before we used RC
  customLevels: process.env.LOG_FILTER || RC.LOG_FILTER,
  level: process.env.LOG_LEVEL || RC.LOG_LEVEL,
  expectedErrorLevel: RC.EXPECTED_ERROR_LEVEL,
  logTransport: RC.LOG_TRANSPORT?.startsWith('{') ? JSON.parse(RC.LOG_TRANSPORT) : RC.LOG_TRANSPORT,
  transportFileOptions: RC.TRANSPORT_FILE_OPTIONS,
  jsonStringifySpacing: RC.JSON_STRINGIFY_SPACING,
  // 'legacy' (default) reproduces the pre-v12 line format byte-for-byte; 'json' emits pino newline-JSON.
  // Deliberately CSL_LOG_FORMAT only (no bare LOG_FORMAT alias): the bare names above exist purely as
  // pre-rc backwards compatibility, and a generic LOG_FORMAT set platform-wide by a log shipper or
  // sidecar must not silently flip csl's output.
  logFormat: RC.LOG_FORMAT === 'json' ? 'json' : 'legacy',
  // D2/P2: CSL_LOG_SYNC=false switches console/file writes to buffered asynchronous mode
  // (sonic-boom, minLength 4096, periodic + on-exit flush) — pino's documented async logging.
  // Default true = synchronous writes, byte-for-byte v11-compatible timing semantics.
  logSync: RC.LOG_SYNC !== false,
  // parity with winston's exceptionHandlers + exitOnError:false (log uncaught exceptions, keep running)
  handleExceptions: RC.HANDLE_EXCEPTIONS !== false
}

module.exports = Config

const RC = require('parse-strings-in-object')(require('rc')('CSL', require('../../config/default.json')))

const Config = {
  // note: We maintain the LOG_LEVEL and LOG_FILTER env variable here to ensure backwards compatibility to before we used RC
  customLevels: process.env.LOG_FILTER || RC.LOG_FILTER,
  level: process.env.LOG_LEVEL || RC.LOG_LEVEL,
  expectedErrorLevel: RC.EXPECTED_ERROR_LEVEL,
  logTransport: RC.LOG_TRANSPORT?.startsWith('{') ? JSON.parse(RC.LOG_TRANSPORT) : RC.LOG_TRANSPORT,
  transportFileOptions: RC.TRANSPORT_FILE_OPTIONS,
  jsonStringifySpacing: RC.JSON_STRINGIFY_SPACING,
  // D3 (pino-native): json is the ONLY output format. CSL_LOG_FORMAT is accepted for
  // compatibility but anything other than 'json' logs a one-time warning and uses json.
  logFormat: 'json',
  // D3 (pino-native): asynchronous buffered writes are the DEFAULT (sonic-boom, 4KB buffer,
  // periodic + on-exit flush — pino's documented max-performance mode). CSL_LOG_SYNC=true
  // opts back into per-line synchronous writes (e.g. for tests that spy process.stdout.write).
  logSync: RC.LOG_SYNC === true,
  // parity with winston's exceptionHandlers + exitOnError:false (log uncaught exceptions, keep running)
  handleExceptions: RC.HANDLE_EXCEPTIONS !== false
}

if (RC.LOG_FORMAT && RC.LOG_FORMAT !== 'json') {
  console.error(`[csl] LOG_FORMAT '${RC.LOG_FORMAT}' is not available in the pino-native build; using 'json'`)
}

module.exports = Config

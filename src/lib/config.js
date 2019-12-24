const RC = require('parse-strings-in-object')(require('rc')('CSL', require('../../config/default.json')))

const Config = {
  // note: We maintain the LOG_LEVEL and LOG_FILTER env variable here to ensure backwards compatibility to before we used RC
  customLevels: process.env.LOG_FILTER || RC.LOG_FILTER,
  level: process.env.LOG_LEVEL || RC.LOG_LEVEL,
  logTransport: RC.LOG_TRANSPORT,
  transportFileOptions: RC.TRANSPORT_FILE_OPTIONS,
  INSTRUMENTATION_METRICS_DISABLED: RC.INSTRUMENTATION.METRICS.DISABLED,
  INSTRUMENTATION_METRICS_LABELS: RC.INSTRUMENTATION.METRICS.labels,
  INSTRUMENTATION_METRICS_CONFIG: RC.INSTRUMENTATION.METRICS.config
}

module.exports = Config

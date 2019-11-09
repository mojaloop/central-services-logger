const RC = require('parse-strings-in-object')(require('rc')('CSL_', require('../../config/default.json')))

console.log("env", process.env.CSL_LOG_TRANSPORT)

const Config = {
  // note: We maintain the LOG_LEVEL and LOG_FILTER env variable here to ensure backwards compatibility to before we used RC
  customLevels: process.env.LOG_FILTER || RC.LOG_FILTER,
  level: process.env.LOG_LEVEL || RC.LOG_LEVEL,
  logTransport: RC.LOG_TRANSPORT,
  transportFileOptions: RC.TRANSPORT_FILE_OPTIONS
}

module.exports = Config

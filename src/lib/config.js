const RC = require('parse-strings-in-object')(require('rc')('CSL_', require('../../config/default.json')))

const Config = {
  customLevels: process.env.LOG_FILTER || RC.LOG_FILTER
  // note: the default LOG_LEVEL env variable will override whatever is in the default.json
  level: process.env.LOG_LEVEL || RC.LOG_LEVEL,
  logTransport: RC.LOG_TRANSPORT,
  transportFileOptions: RC.TRANSPORT_FILE_OPTIONS,

}

export default Config
/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Lazola Lucas <lazola.lucas@modusbox.com>
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const { createLogger, format, transports } = require('winston')
const stringify = require('safe-stable-stringify')
const { customLevels, level, logTransport, transportFileOptions, jsonStringifySpacing } = require('./lib/config')
const { allLevels } = require('./lib/constants')

const { combine, timestamp, colorize, printf } = format

const customLevelsArr = customLevels.split(',').map(l => l.trim()).filter(Boolean)
const ignoredLevels = customLevels ? Object.keys(allLevels).filter(key => !customLevelsArr.includes(key)) : []

const customFormat = printf(({ level, message, timestamp, context }) => {
  let formattedMessage = message
  if (context && context instanceof Object) {
    formattedMessage = stringify({
      ...context,
      message
    }, null, jsonStringifySpacing)
  }
  return `${timestamp} - ${level}: ${formattedMessage}`
})

let transport = new transports.Console()
if (logTransport === 'file') {
  transport = new transports.File(transportFileOptions)
}

const createMlLogger = () => {
  const Logger = createLogger({
    level,
    levels: allLevels,
    format: combine(
      timestamp(),
      colorize({
        colors: {
          audit: 'magenta',
          trace: 'white',
          perf: 'green'
        }
      }),
      customFormat
    ),
    transports: [
      transport
    ],
    exceptionHandlers: [
      transport
    ],
    exitOnError: false
  })

  // Modify Logger before export
  ignoredLevels.forEach(level => { Logger[level] = () => {} })

  // Add "is<level>Enabled" flags
  // Those are used for optimimizing-out disabled logs sub-calls
  //
  // In this example, JSON.stringify() would get called even if "info" level is off.
  //   Logger.info(`Notification:consumeMessage message: - ${JSON.stringify(message)}`)
  // so to optimize-out:
  //   Logger.isInfoEnabled && Logger.info(`Notification:consumeMessage message: - ${JSON.stringify(message)}`)
  Logger.isErrorEnabled = Logger.isLevelEnabled('error')
  Logger.isWarnEnabled = Logger.isLevelEnabled('warn')
  Logger.isAuditEnabled = Logger.isLevelEnabled('audit')
  Logger.isTraceEnabled = Logger.isLevelEnabled('trace')
  Logger.isInfoEnabled = Logger.isLevelEnabled('info')
  Logger.isPerfEnabled = Logger.isLevelEnabled('perf')
  Logger.isVerboseEnabled = Logger.isLevelEnabled('verbose')
  Logger.isDebugEnabled = Logger.isLevelEnabled('debug')
  Logger.isSillyEnabled = Logger.isLevelEnabled('silly')

  return Logger
}

module.exports = createMlLogger

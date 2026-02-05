/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * ModusBox
 - Lazola Lucas <lazola.lucas@modusbox.com>
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const { propagation } = require('@opentelemetry/api')
const { createLogger, format, transports: winstonTransports } = require('winston')
const { LEVEL } = require('triple-beam')
const config = require('./lib/config')
const { customLevels, level, logTransport, transportFileOptions } = config
const { allLevels } = require('./lib/constants')
const UdpTransport = require('./UdpTransport')
const ConsoleTransport = require('./ConsoleTransport')

const customLevelsArr = customLevels.split(',').map(l => l.trim()).filter(Boolean)
const ignoredLevels = customLevels ? Object.keys(allLevels).filter(key => !customLevelsArr.includes(key)) : []

// Expected errors are indicated in the request header
// baggage: errorExpect=<context>.<errorCode>|<context>.<errorCode>
const errorExpect = format(info => {
  const errorCode = info.apiErrorCode?.code
    ?? info.error?.getData?.()?.res?.data?.statusCode
    ?? info.error?.errorInformation?.errorCode
    ?? info.error?.response?.data?.statusCode
    ?? info.response?.body?.statusCode
    ?? info.error?.code
    ?? info.code
  if (['error', 'warn', 'fatal'].includes(info.level) && errorCode && info.context) {
    const errorExpect = propagation.getActiveBaggage()?.getEntry('errorExpect')
    if (errorExpect) {
      const expected = `${info.context}.${errorCode}`
      if (errorExpect.value.split('|').includes(expected)) {
        return {
          ...info,
          expected,
          ...typeof config.expectedErrorLevel === 'string' && {
            [LEVEL]: config.expectedErrorLevel,
            level: config.expectedErrorLevel
          }
        }
      }
    }
  }
  // if (['error', 'warn', 'fatal'].includes(info.level)) debugger;
  return info
})

const transportsMap = {
  console: ConsoleTransport,
  file: winstonTransports.File,
  http: winstonTransports.Http,
  stream: winstonTransports.Stream,
  udp: UdpTransport
}

const createMlLogger = () => {
  let transports
  if (logTransport === 'file') {
    transports = [new winstonTransports.File(transportFileOptions)]
  } else if (typeof logTransport === 'object') {
    transports = Object.entries(logTransport).map(([name, { transport = name, ...config }]) => new transportsMap[transport](config))
  } else transports = [new ConsoleTransport()]

  const Logger = createLogger({
    level,
    levels: allLevels,
    format: format.combine(
      format.timestamp(),
      errorExpect()
    ),
    transports,
    exceptionHandlers: transports,
    exitOnError: false
  })

  // Modify Logger before export
  ignoredLevels.forEach(level => { Logger[level] = () => { } })

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

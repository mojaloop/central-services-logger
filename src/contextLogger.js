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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

/* eslint-disable space-before-function-paren */
const { AsyncLocalStorage } = require('node:async_hooks')
const createMlLogger = require('./createMlLogger')
const { allLevels } = require('./lib/constants')
const { exceptionDto } = require('./otelDto')

const asyncStorage = new AsyncLocalStorage()

const loggerFactory = (context = null) => new ContextLogger(context)

class ContextLogger {
  constructor(context, options = {}) {
    this.mlLogger = options?.mlLogger || createMlLogger()
    this.context = this.createContext(context)
    this.setIsEnabledFlags()
  }

  error(message, meta) {
    this.isErrorEnabled && this.mlLogger.error(...this.formatLog(message, meta))
  }

  warn(message, meta) {
    this.isWarnEnabled && this.mlLogger.warn(...this.formatLog(message, meta))
  }

  info(message, meta) {
    this.isInfoEnabled && this.mlLogger.info(...this.formatLog(message, meta))
  }

  verbose(message, meta) {
    this.isVerboseEnabled && this.mlLogger.verbose(...this.formatLog(message, meta))
  }

  debug(message, meta) {
    this.isDebugEnabled && this.mlLogger.debug(...this.formatLog(message, meta))
  }

  silly(message, meta) {
    this.isSillyEnabled && this.mlLogger.silly(...this.formatLog(message, meta))
  }

  audit (message, meta) {
    this.isAuditEnabled && this.mlLogger.audit(...this.formatLog(message, meta))
  }

  trace(message, meta) {
    this.isTraceEnabled && this.mlLogger.trace(...this.formatLog(message, meta))
  }

  perf(message, meta) {
    this.isPerfEnabled && this.mlLogger.perf(...this.formatLog(message, meta))
  }

  child(context) {
    const { mlLogger } = this
    const childContext = this.createContext(context)
    return new ContextLogger(Object.assign({}, this.context, childContext), { mlLogger })
  }

  setLevel(level) {
    if (allLevels[level] === undefined) {
      this.warn('Unsupported log level:', { level })
      return
    }
    this.mlLogger.level = level
    this.setIsEnabledFlags()
  }

  formatLog(message, meta) {
    const store = asyncStorage.getStore()

    if (!meta && !this.context && !store) return [message]

    const metaData = meta instanceof Error
      ? ContextLogger.formatError(meta)
      : typeof meta === 'object' ? meta : { meta }

    return [message, { ...store, ...this.context, ...metaData }]
  }

  createContext(context) {
    return !context
      ? null
      : typeof context === 'object' ? context : { context }
  }

  setIsEnabledFlags() {
    this.isErrorEnabled = this.mlLogger.isLevelEnabled('error')
    this.isWarnEnabled = this.mlLogger.isLevelEnabled('warn')
    this.isAuditEnabled = this.mlLogger.isLevelEnabled('audit')
    this.isTraceEnabled = this.mlLogger.isLevelEnabled('trace')
    this.isInfoEnabled = this.mlLogger.isLevelEnabled('info')
    this.isPerfEnabled = this.mlLogger.isLevelEnabled('perf')
    this.isVerboseEnabled = this.mlLogger.isLevelEnabled('verbose')
    this.isDebugEnabled = this.mlLogger.isLevelEnabled('debug')
    this.isSillyEnabled = this.mlLogger.isLevelEnabled('silly')
  }

  static formatError(error) {
    const { message, cause, expected, apiErrorCode, response } = error

    return {
      message,
      ...exceptionDto(error),
      ...(expected && { expected }),
      ...(apiErrorCode && { apiErrorCode }),
      ...(response && { httpErrorResponse: response.data }), // for Axios errors
      ...(cause instanceof Error && { cause: ContextLogger.formatError(cause) })
    }
  }
}

module.exports = {
  loggerFactory,
  asyncStorage,
  ContextLogger,
  allLevels
}

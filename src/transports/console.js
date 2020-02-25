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
 - Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Transports = require('winston').transports
const Metrics = require('../lib/metrics')

/**
 * Transport Wrapper for outputting to the console with exposesd metrics.
 * @type {Console}
 * @extends {TransportStream}
 */
module.exports = class MetricConsole extends Transports.Console {
  /**
   * Constructor function for the Console transport object responsible for
   * persisting log messages and metadata to a terminal or TTY.
   * @param {!Object} [options={}] - Options for this instance.
   */
  constructor (options = {}) {
    super(options)
    this._histTimerLog = !!Metrics.isInitiated() && Metrics.getHistogram(
      'central_services_logger_transport_console',
      'Central Services Logger - Performance Metric for Console Transport',
      ['success', 'level']
    )
  }

  /**
   * Core logging method exposed to Winston.
   * @param {Object} info - TODO: add param description.
   * @param {Function} callback - TODO: add param description.
   * @returns {undefined}
   */
  log (info, callback) {
    const histTimerLogTimer = !!Metrics.isInitiated() && this._histTimerLog.startTimer()

    const result = Transports.Console.prototype.log.call(this, info, callback)

    !!Metrics.isInitiated() && histTimerLogTimer({ success: true, level: info.level })
    return result
  }
}

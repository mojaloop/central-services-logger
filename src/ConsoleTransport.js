const stringify = require('safe-stable-stringify')
const { jsonStringifySpacing } = require('./lib/config')

const { transports: { Console }, format: { combine, colorize, printf }, format } = require('winston')

const customFormat = printf(({ level, message, timestamp, ...rest }) => {
  const contextString = Object.values(rest).filter(value => value !== undefined).length ? ' -\t' + stringify(rest, null, jsonStringifySpacing) : ''
  return `${timestamp} - ${level}: ${message}${contextString}`
})

const ignoreExpectedError = format(info => (info.expected && info.level === 'error') ? false : info)

module.exports = class ConsoleTransport extends Console {
  constructor (options) {
    super({
      format: combine(
        ignoreExpectedError(),
        colorize({
          colors: {
            audit: 'magenta',
            trace: 'white',
            perf: 'green'
          }
        }),
        customFormat
      ),
      ...options
    })
  }
}

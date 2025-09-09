const stringify = require('safe-stable-stringify')
const config = require('./lib/config')
const { SENSITIVE_SUBSTRINGS, SENSITIVE_VALUE_PATTERNS } = require('./lib/constants')

const { transports: { Console }, format: { combine, colorize, printf }, format } = require('winston')

const customFormat = printf(({ level, message, timestamp, ...rest }) => {
  function isSensitiveKey (key = '') {
    const lowerKey = key.toLowerCase()
    return SENSITIVE_SUBSTRINGS.some(sub => lowerKey.includes(sub))
  }

  function isSensitiveValue (val) {
    if (typeof val !== 'string') return false
    return SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(val))
  }
  // Redact sensitive info before logging
  // const redactedRest = redact(rest)
  const replacer = (key, value) => {
    if (isSensitiveKey(key) || isSensitiveValue(value)) {
      return '[REDACTED]'
    }
    return value
  }
  const contextString = Object.values(rest).filter(value => value !== undefined).length
    ? ' -\t' + stringify(rest, replacer, config.jsonStringifySpacing)
    : ''
  return `${timestamp} - ${level}: ${message}${contextString}`
})

const ignoreExpectedError = format(info => (info.expected && ['error', 'warn', 'fatal'].includes(info.level) && config.expectedErrorLevel === false) ? false : info)

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

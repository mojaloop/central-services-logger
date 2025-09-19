const stringify = require('safe-stable-stringify')
const config = require('./lib/config')
const { SENSITIVE_SUBSTRINGS, SENSITIVE_VALUE_PATTERNS, SENSITIVE_KEY_EXCLUSIONS } = require('./lib/constants')

const { transports: { Console }, format: { combine, colorize, printf }, format } = require('winston')

const customFormat = printf(({ level, message, timestamp, ...rest }) => {
  function isSensitiveKey (key = '') {
    const lowerKey = key.toLowerCase()
    if (isExcludedKey(lowerKey)) {
      return false
    }
    return SENSITIVE_SUBSTRINGS.some(sub => lowerKey.includes(sub))
  }

  function isSensitiveValue (val) {
    if (typeof val !== 'string') return false
    return SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(val))
  }

  function isExcludedKey (key = '') {
    const lowerKey = key.toLowerCase()
    return SENSITIVE_KEY_EXCLUSIONS.includes(lowerKey)
  }

  // Redact sensitive info before logging
  const replacer = (key, value) => {
    if (isExcludedKey(key)) {
      return value
    }
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

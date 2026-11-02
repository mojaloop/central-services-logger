const stringify = require('safe-stable-stringify')
const config = require('./lib/config')
const { SENSITIVE_SUBSTRINGS, SENSITIVE_VALUE_PATTERNS, SENSITIVE_KEY_EXCLUSIONS } = require('./lib/constants')

const { format: { combine, colorize, printf }, format } = require('winston')

function isSensitiveKey (key) {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_SUBSTRINGS.some(sub => lowerKey.includes(sub))
}

function isSensitiveValue (val) {
  if (typeof val !== 'string') return false
  return SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(val))
}

function isExcludedKey (key) {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_KEY_EXCLUSIONS.includes(lowerKey)
}

const redact = (key, value) => {
  if (isExcludedKey(key)) {
    return value
  }
  if (isSensitiveKey(key) || isSensitiveValue(value)) {
    return '[REDACTED]'
  }
  return value
}

const customFormat = printf(({ level, message, timestamp, ...rest }) => {
  const contextString = Object.values(rest).filter(value => value !== undefined).length
    ? ' -\t' + stringify(rest, redact, config.jsonStringifySpacing)
    : ''
  return `${timestamp} - ${level}: ${message}${contextString}`
})

const ignoreExpectedError = format(info => (info.expected && ['error', 'warn', 'fatal'].includes(info.level) && config.expectedErrorLevel === false) ? false : info)

const levelColors = () => colorize({
  colors: {
    audit: 'magenta',
    trace: 'white',
    perf: 'green'
  }
})

const textFormat = ({ colorize: colored = true } = {}) => combine(
  ignoreExpectedError(),
  ...(colored ? [levelColors()] : []),
  customFormat
)

module.exports = textFormat

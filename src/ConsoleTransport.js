const stringify = require('safe-stable-stringify')
const config = require('./lib/config')

const SENSITIVE_SUBSTRINGS = [
  'token',
  'auth',
  'api',
  'secret',
  'client',
  'password',
  'passphrase',
  'private',
  'jwt',
  'session',
  'cookie',
  'key',
  'credential',
  'access',
  'refresh',
  'pin',
  'ssn',
  'credit_card',
  'card_number',
  'cvv',
  'iban_code',
  'bic',
  'account_number',
  'routing_number',
  'security_answer'
]

const SENSITIVE_VALUE_PATTERNS = [
  /^-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/,
  /^-----BEGIN PRIVATE KEY-----/,
  /^-----BEGIN (CERTIFICATE|CA CERTIFICATE)-----/,
  /^eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/, // JWT
  /password/i,
  /secret/i,
  /token/i,
  /private/i,
  /key/i,
  /bearer\s+[a-z0-9-_.]+/i,
  /sessionid/i,
  /cookie/i,
  /api[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /client[_-]?secret/i,
  /client[_-]?id/i,
  /auth[_-]?token/i,
  /credential/i,
  /\b\d{12,19}\b/, // possible credit card numbers
  /\b\d{3,4}\b/, // possible CVV
  /\b\d{9}\b/, // possible SSN
  /pin/i,
  /passphrase/i,
  /account[_-]?number/i,
  /routing[_-]?number/i,
  /iban_code/i,
  /bic/i,
  /security[_-]?answer/i
]

function isSensitiveKey(key = '') {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_SUBSTRINGS.some(sub => lowerKey.includes(sub))
}

function isSensitiveValue(val) {
  if (typeof val !== 'string') return false
  return SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(val))
}

function redact(obj, key, seen = new WeakSet(), path = []) {
  if (obj == null || typeof obj !== 'object') {
    if (isSensitiveKey(key) || isSensitiveValue(obj)) {
      return '[REDACTED]'
    }
    return obj
  }
  if (seen.has(obj)) {
    // Use fast-safe-stringify style: [Circular]
    return `[Circular]`
  }
  seen.add(obj)
  if (Array.isArray(obj)) {
    const arr = obj.map((v, i) => redact(v, undefined, seen, path.concat([i])))
    seen.delete(obj)
    return arr
  }
  const result = {}
  for (const k of Object.keys(obj)) {
    if (isSensitiveKey(k) || isSensitiveValue(obj[k])) {
      result[k] = '[REDACTED]'
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      if (seen.has(obj[k])) {
        result[k] = '[Circular]'
      } else {
        const redacted = redact(obj[k], k, seen, path.concat([k]))
        if (redacted !== undefined) {
          result[k] = redacted
        }
      }
    } else {
      result[k] = obj[k]
    }
  }
  seen.delete(obj)
  return result
}

const { transports: { Console }, format: { combine, colorize, printf }, format } = require('winston')

const customFormat = printf(({ level, message, timestamp, ...rest }) => {
  // Redact sensitive info before logging
  const redactedRest = redact(rest)
  const contextString = Object.values(redactedRest).filter(value => value !== undefined).length
    ? ' -\t' + stringify(redactedRest, null, config.jsonStringifySpacing)
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

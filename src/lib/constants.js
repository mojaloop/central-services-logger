const allLevels = Object.freeze({
  error: 0, warn: 1, audit: 2, trace: 3, info: 4, perf: 5, verbose: 6, debug: 7, silly: 8
})

const SENSITIVE_SUBSTRINGS = Object.freeze([
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
])

const SENSITIVE_VALUE_PATTERNS = Object.freeze([
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
])

module.exports = {
  allLevels,
  SENSITIVE_SUBSTRINGS,
  SENSITIVE_VALUE_PATTERNS
}

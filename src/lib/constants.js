const allLevels = Object.freeze({
  error: 0, warn: 1, audit: 2, trace: 3, info: 4, perf: 5, verbose: 6, debug: 7, silly: 8
})

const SENSITIVE_KEY_EXCLUSIONS = Object.freeze([
  'context',
  'stack'
])

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
  // Private keys (PEM format)
  /^-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/,
  /^-----BEGIN PRIVATE KEY-----/,
  // Certificates (PEM format)
  /^-----BEGIN (CERTIFICATE|CA CERTIFICATE)-----/,
  // JWT tokens (header.payload.signature)
  /^eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/,
  // Basic Bearer tokens
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i
])

module.exports = {
  allLevels,
  SENSITIVE_SUBSTRINGS,
  SENSITIVE_VALUE_PATTERNS,
  SENSITIVE_KEY_EXCLUSIONS
}

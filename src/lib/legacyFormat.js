const os = require('node:os')
const stringify = require('safe-stable-stringify')

// ANSI codes measured on v11 (winston 3.19 + logform colorize with csl's custom colors);
// logform forces colours on regardless of TTY, so v12 does the same.
const LEVEL_ANSI = {
  error: '31',
  warn: '33',
  audit: '35',
  trace: '37',
  info: '32',
  perf: '32',
  verbose: '36',
  debug: '34',
  silly: '35'
}

function hasRenderableValue (meta) {
  for (const key in meta) {
    if (meta[key] !== undefined) return true
  }
  return false
}

/**
 * Byte-exact reproduction of the pre-v12 winston line:
 *   `${ISO timestamp} - ${colorized level}: ${message}[ -\t${stringify(meta, spacing)}]` + EOL
 * Redaction has already been applied upstream, so stringify runs without a replacer.
 */
function renderLegacyLine (rec, spacing) {
  const colour = LEVEL_ANSI[rec.levelName] || '32'
  const contextString = rec.meta && hasRenderableValue(rec.meta)
    ? ' -\t' + stringify(rec.meta, null, spacing)
    : ''
  return `${rec.time} - \u001b[${colour}m${rec.levelName}\u001b[39m: ${rec.message}${contextString}${os.EOL}`
}

module.exports = { renderLegacyLine, LEVEL_ANSI }

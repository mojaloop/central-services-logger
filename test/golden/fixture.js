'use strict'
/*
 * Golden-format fixture: exercises every PARITY argument shape (the deliberate v12 fixes —
 * bare Error, object-without-message, printf interpolation, meta.timestamp — are excluded here;
 * they are covered with their new behaviour in test/unit/MlLogger.test.js).
 * Run with CSL_PATH pointing at the implementation to exercise; stdout is the artefact.
 */
const cslPath = process.env.CSL_PATH
const Logger = require(cslPath)
const { loggerFactory, asyncStorage } = require(`${cslPath}/src/contextLogger`)

Logger.level = 'silly'

for (const level of ['error', 'warn', 'audit', 'trace', 'info', 'perf', 'verbose', 'debug', 'silly']) {
  Logger[level](`plain ${level}`)
}

Logger.info('meta', { b: 2, arr: [1, 'two'], nested: { x: 1 } })
Logger.info('append', { message: 'M2', c: 3, level: 'zap' })
Logger.info('keep-time', { time: 'TIME-META' })

const err = new Error('boom')
err.code = 'E1'
err.extra = 'vis'
err.cause = new Error('inner')
Logger.error('failed', err)
Logger.warn('warned', err)

Logger.info({ message: 'objmsg', k: 1 })
Logger.info('primitive', 42)
Logger.info('nullmeta', null)
Logger.info(null)

const o1 = { a: 1 }
const o2 = { o1 }
o1.loop = o2
Logger.info('circular', { c: o2 })

Logger.info('sensitive', {
  password: 'p',
  nested: { apiKey: 'k', normal: 'n' },
  arr: [{ token: 't' }],
  context: 'excluded-ok',
  stack: 'keep Bearer abc',
  bearer: 'Bearer abc.def',
  jwt: 'eyJab.eyJcd.ef',
  pem: '-----BEGIN PRIVATE KEY-----\nX'
})

const child = Logger.child({ a: 'bind', password: 'redact-me' })
child.info('child line', { b: 'meta' })
Logger.child().info('no-bind child')

// documented v12 fix: log() now honours LOG_FILTER (v11's filter only no-op'd the level methods,
// so .log() bypassed it) — parity for log() is asserted in the unfiltered variants only
if (!process.env.LOG_FILTER) Logger.log('info', 'via log', { z: 1 })

const expectedErr = new Error('exp')
expectedErr.expected = true
Logger.error('expected?', expectedErr)

const log = loggerFactory('ctx')
asyncStorage.run({ requestId: 'REQ1' }, () => {
  log.info('ctx line', { m: 1 })
  log.error('ctx err: ', err)
})

const axiosErr = new Error('HttpError')
axiosErr.response = { data: { code: '1001', message: 'x' } }
log.error('http: ', axiosErr)

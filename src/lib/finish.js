'use strict'

const fs = require('node:fs')
const { MESSAGE } = require('triple-beam')
const { Logger: WinstonLogger } = require('winston')
const { TRANSPORT_EVENTS } = require('./constants')
const textFormat = require('../textFormat')

const loggerEvents = Object.freeze({
  close: 'close',
  data: 'data',
  finish: 'finish'
})

const STDERR_FD = 2

// Longest silence between two records a healthy transport finished while flushing 20000
// queued records at 50m CPU, the smallest limit the Mojaloop charts set: 901 ms over 60 runs,
// in whole 100 ms CFS periods. The deadline is the next period.
const FINISH_STALL_MS = 1000

const loggers = new Set()
const stderrFormat = textFormat({ colorize: false })
const endTransports = WinstonLogger.prototype._final

function endTransportsWhenDrained (callback) {
  const drained = () => this._readableState.length === 0
  if (drained()) return endTransports.call(this, callback)
  const onData = () => {
    if (!drained()) return
    this.removeListener(loggerEvents.data, onData)
    endTransports.call(this, callback)
  }
  this.on(loggerEvents.data, onData)
}

const writeToStderr = (logger, info) => {
  if (!logger.isLevelEnabled(info.level)) return
  const record = logger.format.transform({ ...info }, logger.format.options)
  const formatted = record && stderrFormat.transform(record, stderrFormat.options)
  if (formatted) fs.writeSync(STDERR_FD, `${formatted[MESSAGE]}\n`)
}

const end = logger => new Promise(resolve => {
  logger.once(loggerEvents.finish, resolve)
  logger.end()
})

const finish = () => new Promise((resolve, reject) => {
  const pending = [...loggers]
  const settle = (settleWith, value) => {
    clearTimeout(stall)
    settleWith(value)
  }
  const stall = setTimeout(
    () => settle(reject, new Error(`log transports made no progress for ${FINISH_STALL_MS} ms`)),
    FINISH_STALL_MS
  )
  const progress = () => stall.refresh()
  pending.flatMap(logger => logger.transports).forEach(transport => {
    transport.on(TRANSPORT_EVENTS.logged, progress)
    transport.on(TRANSPORT_EVENTS.warn, progress)
  })
  Promise.all(pending.map(end)).then(() => settle(resolve), error => settle(reject, error))
})

const register = logger => {
  const write = logger.write.bind(logger)
  logger.write = (info, ...rest) => {
    if (!logger._writableState.ending) return write(info, ...rest)
    writeToStderr(logger, info)
    return true
  }
  logger._final = endTransportsWhenDrained
  loggers.add(logger)
  logger.once(loggerEvents.close, () => loggers.delete(logger))
  logger.once(loggerEvents.finish, () => loggers.delete(logger))
}

module.exports = {
  FINISH_STALL_MS,
  finish,
  register
}

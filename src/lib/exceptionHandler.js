const os = require('node:os')

// The slot lives on globalThis under a registered Symbol so nested copies of this package and
// jest.resetModules re-requires share ONE process listener. The slot is a mutable box dereferenced
// at throw time: every createMlLogger() re-points it, so the last-created root's configuration
// (level, format, redaction, transports) handles the crash — never a dead instance.
const SLOT = Symbol.for('csl.exceptionHandler')

function buildCrashMeta (err) {
  return {
    error: err,
    stack: err?.stack,
    exception: true,
    date: new Date().toString(),
    process: {
      pid: process.pid,
      ...(process.getuid && { uid: process.getuid() }),
      ...(process.getgid && { gid: process.getgid() }),
      cwd: process.cwd(),
      execPath: process.execPath,
      version: process.version,
      argv: process.argv,
      memoryUsage: process.memoryUsage()
    },
    os: {
      loadavg: os.loadavg(),
      uptime: os.uptime()
    }
  }
}

/**
 * Parity with winston's exceptionHandlers + exitOnError:false: the uncaught exception is logged
 * through the logger and the process KEEPS RUNNING — minus the v11 defects (a listener per
 * loggerFactory() call and a stray second 'undefined' line). Opt out with CSL_HANDLE_EXCEPTIONS=false.
 */
function register (root) {
  let slot = globalThis[SLOT]
  if (!slot) {
    slot = { root: null }
    globalThis[SLOT] = slot
    slot.listener = (err) => {
      try {
        const message = `uncaughtException: ${err?.message}${err?.stack ? '\n' + err.stack : ''}`
        slot.root?.error(message, buildCrashMeta(err))
      } catch { /* never let crash logging crash the handler */ }
    }
    process.on('uncaughtException', slot.listener)
  }
  slot.root = root
}

/* test hook */
function unregister () {
  const slot = globalThis[SLOT]
  if (slot) {
    process.removeListener('uncaughtException', slot.listener)
    delete globalThis[SLOT]
  }
}

module.exports = { register, unregister }

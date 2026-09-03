'use strict'
// Crash-parity fixture: the process must log the uncaught exception and KEEP RUNNING (exit 0).
require(process.env.CSL_PATH)
setTimeout(() => { throw new Error('crash-test') }, 10)
setTimeout(() => { console.log('SURVIVED') }, 100)

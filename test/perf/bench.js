'use strict'
/*
 * D3 micro-benchmark: v11 (winston) | D1-json | D2 json+async | D3 sync | D3 (default: json+async,
 * pino-native children) | raw pino (the ceiling: no wrapper, native call convention).
 * Run: npm run bench   (log output goes to stdout — discarded; results print to stderr)
 * Protocol: interleaved rounds, medians + spread (never compare single passes).
 */
const { spawnSync } = require('node:child_process')

const D1_PATH = process.env.CSL_D1_PATH || '/Users/jc/ml/central-services-logger'
const D2_PATH = process.env.CSL_D2_PATH || '/Users/jc/ml/central-services-logger-pino-performance'

const TARGETS = {
  v11: { module: 'csl11' },
  'd1-json': { module: D1_PATH, env: { CSL_LOG_FORMAT: 'json' } },
  'd2-json-async': { module: D2_PATH, env: { CSL_LOG_FORMAT: 'json', CSL_LOG_SYNC: 'false' } },
  'd3-sync': { module: '../../src/index', env: { CSL_LOG_SYNC: 'true' } },
  d3: { module: '../../src/index' },
  'raw-pino': { raw: true }
}

function makeRawLogger () {
  const pino = require('pino')
  return pino({ base: null, timestamp: pino.stdTimeFunctions.isoTime, messageKey: 'message' },
    pino.destination({ fd: 1, sync: false, minLength: 4096 }))
}

function runScenarios (Logger, raw) {
  const { performance } = require('node:perf_hooks')
  const err = new Error('bench error')
  err.code = 'E_BENCH'
  const meta = { a: 1, b: 'two', nested: { c: 3 } }
  const child = raw ? Logger.child({ component: 'bench' }) : Logger.child({ component: 'bench' })

  // raw pino uses its native (mergingObject, message) convention and has no cached flags
  const scenarios = raw
    ? {
        'plain message': [200_000, i => Logger.info('hello world ' + (i & 7))],
        'message + meta': [200_000, () => Logger.info(meta, 'hello')],
        'message + Error': [100_000, () => Logger.error({ err }, 'failed')],
        'child + meta': [200_000, () => child.info(meta, 'c')],
        'disabled level (guarded)': [2_000_000, i => Logger.isLevelEnabled('debug') && Logger.debug('skip ' + i)],
        'disabled level (unguarded)': [2_000_000, () => Logger.debug('skip')]
      }
    : {
        'plain message': [200_000, i => Logger.info('hello world ' + (i & 7))],
        'message + meta': [200_000, () => Logger.info('hello', meta)],
        'message + Error': [100_000, () => Logger.error('failed', err)],
        'child + meta': [200_000, () => child.info('c', meta)],
        'disabled level (guarded)': [2_000_000, i => Logger.isDebugEnabled && Logger.debug('skip ' + i)],
        'disabled level (unguarded)': [2_000_000, () => Logger.debug('skip')]
      }

  const results = {}
  for (const [name, [n, fn]] of Object.entries(scenarios)) {
    for (let i = 0; i < 2000; i++) fn(i) // warm-up
    const start = performance.now()
    for (let i = 0; i < n; i++) fn(i)
    const ms = performance.now() - start
    results[name] = Math.round(n / (ms / 1000))
  }
  if (Logger.flush) Logger.flush()
  return results
}

if (process.env.BENCH_TARGET) {
  const target = TARGETS[process.env.BENCH_TARGET]
  const Logger = target.raw ? makeRawLogger() : require(target.module)
  console.error(JSON.stringify(runScenarios(Logger, !!target.raw)))
} else {
  const REPS = Number(process.env.BENCH_REPS || 5)
  const names = Object.keys(TARGETS)
  const samples = Object.fromEntries(names.map(n => [n, {}]))

  for (let rep = 0; rep < REPS; rep++) {
    for (const name of names) {
      const res = spawnSync(process.execPath, [__filename], {
        cwd: __dirname,
        env: { ...process.env, CSL_LOG_LEVEL: 'info', BENCH_TARGET: name, ...(TARGETS[name].env || {}) },
        stdio: ['ignore', 'ignore', 'pipe'],
        encoding: 'utf8',
        timeout: 300_000
      })
      if (res.status !== 0) throw new Error(`${name} failed: ${res.stderr}`)
      const round = JSON.parse(res.stderr.trim().split('\n').at(-1))
      for (const [scenario, ops] of Object.entries(round)) {
        (samples[name][scenario] = samples[name][scenario] || []).push(ops)
      }
    }
    console.error(`round ${rep + 1}/${REPS} done`)
  }

  const median = arr => {
    const s = [...arr].sort((a, b) => a - b)
    const mid = s.length >> 1
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
  }
  const all = Object.fromEntries(names.map(n =>
    [n, Object.fromEntries(Object.entries(samples[n]).map(([s, arr]) => [s, median(arr)]))]))
  const spread = (n, s) => `${Math.min(...samples[n][s])}..${Math.max(...samples[n][s])}`

  const scenarios = Object.keys(all.v11)
  const width = Math.max(...scenarios.map(s => s.length)) + 2
  console.error(`\nmedian ops/sec of ${REPS} interleaved rounds (higher is better) — node ${process.version}\n`)
  console.error(''.padEnd(width) + names.map(h => h.padStart(15)).join(''))
  for (const s of scenarios) {
    console.error(s.padEnd(width) + names.map(t => String(all[t][s]).padStart(15)).join(''))
  }
  console.error('\nmin..max spread per target:')
  for (const s of scenarios) {
    console.error(`  ${s.padEnd(width)}` + names.map(t => spread(t, s).padStart(22)).join(''))
  }
  console.error('\nmedian ratios per scenario:')
  for (const s of scenarios) {
    const r = (a, b) => (all[a][s] / all[b][s]).toFixed(2)
    console.error(
      `  ${s.padEnd(width)} d3/v11=${r('d3', 'v11')}  d3/d2-json-async=${r('d3', 'd2-json-async')}  ` +
      `d3/d3-sync=${r('d3', 'd3-sync')}  raw/d3=${r('raw-pino', 'd3')}`
    )
  }
  console.error('')
}

'use strict'
/*
 * Micro-benchmark at the D1 measurement point, extended for D2:
 *   v11 (winston, `csl11` alias) | D1 legacy/json (the major/pino checkout) | D2 legacy/json (this
 *   worktree, P3 optimisations) | D2 async (CSL_LOG_SYNC=false, P2).
 * Run: npm run bench   (log output goes to stdout — discarded; results print to stderr)
 * Evidence for mojaloop/project #3621 / #4543.
 */
const { spawnSync } = require('node:child_process')

const D1_PATH = process.env.CSL_D1_PATH || '/Users/jc/ml/central-services-logger'

const TARGETS = {
  v11: { module: 'csl11' },
  'd1-legacy': { module: D1_PATH },
  'd1-json': { module: D1_PATH, env: { CSL_LOG_FORMAT: 'json' } },
  'd2-legacy': { module: '../../src/index' },
  'd2-json': { module: '../../src/index', env: { CSL_LOG_FORMAT: 'json' } },
  'd2-legacy-async': { module: '../../src/index', env: { CSL_LOG_SYNC: 'false' } },
  'd2-json-async': { module: '../../src/index', env: { CSL_LOG_FORMAT: 'json', CSL_LOG_SYNC: 'false' } }
}

function runScenarios (Logger) {
  const { performance } = require('node:perf_hooks')
  const err = new Error('bench error')
  err.code = 'E_BENCH'
  const child = Logger.child ? Logger.child({ component: 'bench' }) : Logger
  const meta = { a: 1, b: 'two', nested: { c: 3 } }

  const scenarios = {
    'plain message': [200_000, i => Logger.info('hello world ' + (i & 7))],
    'message + meta': [200_000, i => Logger.info('hello', meta)],
    'message + Error': [100_000, i => Logger.error('failed', err)],
    'child + meta': [200_000, i => child.info('c', meta)],
    'disabled level (guarded)': [2_000_000, i => Logger.isDebugEnabled && Logger.debug('skip ' + i)],
    'disabled level (unguarded)': [2_000_000, i => Logger.debug('skip')]
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
  const Logger = require(target.module)
  console.error(JSON.stringify(runScenarios(Logger)))
} else {
  // Interleaved rounds + medians + spread: the same noise-gate protocol the fleet baselines use —
  // back-to-back blocks confound variant with machine drift, so never compare single passes.
  const REPS = Number(process.env.BENCH_REPS || 5)
  const names = Object.keys(TARGETS)
  const samples = Object.fromEntries(names.map(n => [n, {}]))

  for (let rep = 0; rep < REPS; rep++) {
    for (const name of names) {
      const res = spawnSync(process.execPath, [__filename], {
        cwd: __dirname,
        env: { ...process.env, CSL_LOG_LEVEL: 'info', BENCH_TARGET: name, ...(TARGETS[name].env || {}) },
        stdio: ['ignore', 'ignore', 'pipe'], // stdout (the log lines) is discarded
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
  const spread = (n, s) => {
    const arr = samples[n][s]
    return `${Math.min(...arr)}..${Math.max(...arr)}`
  }

  const scenarios = Object.keys(all.v11)
  const width = Math.max(...scenarios.map(s => s.length)) + 2
  console.error(`\nmedian ops/sec of ${REPS} interleaved rounds (higher is better) — node ${process.version}\n`)
  console.error(''.padEnd(width) + names.map(h => h.padStart(16)).join(''))
  for (const s of scenarios) {
    console.error(s.padEnd(width) + names.map(t => String(all[t][s]).padStart(16)).join(''))
  }
  console.error('\nmin..max spread per target:')
  for (const s of scenarios) {
    console.error(`  ${s.padEnd(width)}` + names.map(t => spread(t, s).padStart(24)).join(''))
  }
  console.error('\nmedian ratios per scenario:')
  for (const s of scenarios) {
    const r = (a, b) => (all[a][s] / all[b][s]).toFixed(2)
    console.error(
      `  ${s.padEnd(width)} d2-json/v11=${r('d2-json', 'v11')}  d2-json/d1-json=${r('d2-json', 'd1-json')}  ` +
      `d2-legacy/d1-legacy=${r('d2-legacy', 'd1-legacy')}  json-async/json-sync=${r('d2-json-async', 'd2-json')}  legacy-async/legacy-sync=${r('d2-legacy-async', 'd2-legacy')}`
    )
  }
  console.error('')
}

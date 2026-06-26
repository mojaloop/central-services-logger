module.exports = {
  reject: [
    // @types/node must track the Node.js runtime major used by this library (Node 24, per .nvmrc),
    // not run ahead of it. A 24.x -> 26.x bump pulls in type definitions for runtime APIs that do
    // not exist on Node 24, which can mask genuine type errors in the shipped .d.ts files
    // (index.d.ts / contextLogger.d.ts) and the tsc type-check. Pin to the 24.x line until the
    // runtime itself moves to a newer major.
    '@types/node'
  ]
}

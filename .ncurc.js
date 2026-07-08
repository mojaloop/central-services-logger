module.exports = {
  reject: [
    // @types/node's major must match the Node runtime major in .nvmrc (currently 24). A higher major
    // makes tsc accept Node-26-only APIs that then crash at runtime on Node 24 — a failure mode the
    // test gates cannot catch (it only weakens type checking). Bump together with the runtime.
    '@types/node'
  ]
}


/**
 * Remove a certain module or path from node's module cache
 * Useful for testing changes in environment variables
 * @param {*} pathFragments
 */
const removeFromCache = (pathFragments) => {
  pathFragments.forEach(pathFragment => {
    Object.keys(require.cache)
      .filter(k => k.indexOf(pathFragment) > -1)
      .forEach(k => delete require.cache[k])
  })
}

module.exports = {
  removeFromCache
}

// SOURCE OF TRUTH: /shared/update.js. Do not edit copies under services/*/shared — run "make sync".

/**
 * Turns a partial update into dot paths for $set, so nested objects are merged, not replaced.
 *
 *   { title: 'X', price: { rent: 2 } }  →  { title: 'X', 'price.rent': 2 }
 *
 * Without this, $set: { price: { rent: 2 } } would wipe price.buy and price.currency.
 * Arrays and Dates are kept whole (they are values, not nested objects).
 *
 * @param {object} changes
 * @param {string} [prefix]
 * @returns {Object<string, any>}
 */
function toSetPaths(changes, prefix = '') {
    const paths = {}
    for (const [key, value] of Object.entries(changes)) {
        const path = prefix ? `${prefix}.${key}` : key
        const isPlainObject = value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
        if (isPlainObject) Object.assign(paths, toSetPaths(value, path))
        else paths[path] = value
    }
    return paths
}

module.exports = { toSetPaths }

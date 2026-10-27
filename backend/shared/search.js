// SOURCE OF TRUTH: /shared/search.js. Do not edit copies under services/*/shared — run "make sync".

/**
 * Condition for "field STARTS WITH text" (case-sensitive), e.g. { title: prefixMatch('Space') }.
 * An anchored (^), case-sensitive regex is the only kind of regex MongoDB can answer from an index:
 * with { title: 1 } it scans just the range of keys that start with the text (IXSCAN).
 * Special characters are escaped, so the user's text is matched literally ('A.I' does not match 'ABI').
 *
 * @param {string} text
 * @returns {{$regex: string}}
 */
function prefixMatch(text) {
    return { $regex: `^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
}

module.exports = { prefixMatch }

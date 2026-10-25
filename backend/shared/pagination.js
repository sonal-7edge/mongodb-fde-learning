// SOURCE OF TRUTH: /shared/pagination.js. Do not edit copies under services/*/shared — run "make sync".
const mongoose = require('mongoose')
const { HttpError } = require('./errors.js')

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

/**
 * Range (cursor) pagination on (sortField, _id) instead of skip().
 * skip(N) still walks N index entries; a range filter jumps straight to the next page.
 * (mongoose-paginate-v2's paginate() uses skip; compare the two with ?explain=true.)
 *
 * The cursor is the last item's sort value and _id, base64url-encoded so clients treat it as opaque.
 */

/**
 * @param {number|undefined} limit
 * @returns {number} between 1 and MAX_LIMIT
 */
function clampLimit(limit) {
    if (!Number.isFinite(limit)) return DEFAULT_LIMIT
    return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT)
}

/**
 * @param {object} lastDoc
 * @param {string} sortField  e.g. 'rating' or 'joined_at'
 * @returns {string}
 */
function encodeCursor(lastDoc, sortField) {
    const value = sortField.split('.').reduce((obj, key) => obj?.[key], lastDoc) ?? null
    const isDate = value instanceof Date
    const payload = { v: isDate ? value.toISOString() : value, d: isDate, id: String(lastDoc._id) }
    return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

/**
 * @param {string} cursor
 * @returns {{value: any, id: mongoose.Types.ObjectId}}
 */
function decodeCursor(cursor) {
    try {
        const { v, d, id } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
        return { value: d ? new Date(v) : v, id: new mongoose.Types.ObjectId(String(id)) }
    } catch {
        throw new HttpError(400, 'Invalid cursor')
    }
}

/**
 * Filter that returns documents strictly after the cursor, for a sort of { [sortField]: direction, _id: direction }.
 * Note: documents whose sort value is null are not paged past by this simple version.
 *
 * @param {string} sortField
 * @param {1|-1} direction
 * @param {string|undefined} cursor
 * @returns {object} a MongoDB filter fragment ({} when there is no cursor)
 */
function afterCursorFilter(sortField, direction, cursor) {
    if (!cursor) return {}
    const { value, id } = decodeCursor(cursor)
    const beyond = direction === -1 ? '$lt' : '$gt'
    return {
        $or: [{ [sortField]: { [beyond]: value } }, { [sortField]: value, _id: { [beyond]: id } }],
    }
}

/**
 * Builds the response page. We fetch limit + 1 rows to know if another page exists.
 * @param {object[]} rows
 * @param {number} limit
 * @param {string} sortField
 * @returns {{items: object[], next_cursor: string|null}}
 */
function toPage(rows, limit, sortField) {
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1], sortField) : null
    return { items, next_cursor: nextCursor }
}

module.exports = { MAX_LIMIT, DEFAULT_LIMIT, clampLimit, encodeCursor, decodeCursor, afterCursorFilter, toPage }

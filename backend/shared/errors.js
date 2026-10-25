// SOURCE OF TRUTH: /shared/errors.js. Do not edit copies under services/*/shared — run "make sync".
const mongoose = require('mongoose')

/** An error that already knows its HTTP status. Throw it from any route or query. */
class HttpError extends Error {
    /**
     * @param {number} status
     * @param {string} message
     * @param {object} [details]
     */
    constructor(status, message, details) {
        super(message)
        this.name = 'HttpError'
        this.status = status
        this.details = details
        // Each service has its own synced copy of this file, so `instanceof HttpError` fails across
        // services (two copies = two different classes). The error handler checks this flag instead.
        this.isHttpError = true
    }
}

/** Express handler for routes nobody matched. */
function notFound(req, _res, next) {
    next(new HttpError(404, `No route for ${req.method} ${req.path}`))
}

/**
 * Turns any thrown error into a JSON response. Never sends a stack trace to the client.
 * Joi / ValidationError / CastError → 400, duplicate key → 409, HttpError → its status, else 500.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, _req, res, _next) {
    const { status, body } = toResponse(error)
    if (status >= 500) console.error(error)
    res.status(status).json(body)
}

/**
 * @param {any} error
 * @returns {{status: number, body: {error: string, details?: any}}}
 */
function toResponse(error) {
    if (error?.isHttpError) {
        return { status: error.status, body: { error: error.message, details: error.details } }
    }
    // Joi validation error (from shared/validate.js)
    if (error?.isJoi) {
        const details = error.details.map((d) => ({ path: d.path.join('.'), message: d.message }))
        return { status: 400, body: { error: 'Invalid request', details } }
    }
    if (error instanceof mongoose.Error.ValidationError) {
        const details = Object.values(error.errors).map((e) => ({ path: e.path, message: e.message }))
        return { status: 400, body: { error: 'Invalid document', details } }
    }
    if (error instanceof mongoose.Error.CastError) {
        return { status: 400, body: { error: `Invalid value for ${error.path}: ${JSON.stringify(error.value)}` } }
    }
    // 11000 is MongoDB's duplicate key error code (a unique index refused the write).
    if (error?.code === 11000) {
        return { status: 409, body: { error: 'Duplicate key', details: error.keyValue } }
    }
    // Malformed JSON body from express.json()
    if (error?.type === 'entity.parse.failed') {
        return { status: 400, body: { error: 'Malformed JSON body' } }
    }
    return { status: 500, body: { error: 'Internal server error' } }
}

module.exports = { HttpError, notFound, errorHandler }

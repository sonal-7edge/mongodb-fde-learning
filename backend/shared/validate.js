// SOURCE OF TRUTH: /shared/validate.js. Do not edit copies under services/*/shared — run "make sync".

/**
 * Joi middleware. Validates body / query / params with the given Joi schemas and stores the clean
 * values on req.valid (Express 5 makes req.query read-only, so we never overwrite it).
 * A failed validation is passed on as a Joi ValidationError, which errors.js turns into a 400.
 *
 * Usage: router.post('/x', validate({ body: Joi.object({ name: Joi.string().required() }) }), handler)
 *
 * @param {{body?: import('joi').Schema, query?: import('joi').Schema, params?: import('joi').Schema}} schemas
 */
function validate(schemas) {
    return function validateRequest(req, _res, next) {
        req.valid = {}
        for (const part of ['body', 'query', 'params']) {
            const input = req[part] ?? {}
            if (!schemas[part]) {
                req.valid[part] = input
                continue
            }
            // abortEarly: false = report every problem at once, not just the first one
            const { value, error } = schemas[part].validate(input, { abortEarly: false })
            if (error) return next(error)
            req.valid[part] = value
        }
        next()
    }
}

module.exports = { validate }

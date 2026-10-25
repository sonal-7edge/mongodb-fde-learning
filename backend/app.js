const mongoose = require('mongoose')

// Each service requires its own synced copy of the entities, so the same model name is registered
// more than once in this process. Allow that (otherwise Mongoose throws OverwriteModelError).
// Must run before any entity file is required below.
mongoose.set('overwriteModels', true)

const express = require('express')
// app.js requires shared code through a service's synced copy, never the root shared/
// (the Docker image does not contain the root entities/ and shared/ folders).
const { loadAuthConfig, requireAuth } = require('./services/platform/shared/auth.js')
const { errorHandler, notFound } = require('./services/platform/shared/errors.js')
const { serverTiming } = require('./services/platform/shared/timing.js')
const { buildPlatformRouters } = require('./services/platform/routes/index.js')
const { movieStoreRouter } = require('./services/movie_store/routes/index.js')
const { employeeRouter } = require('./services/employee_management/routes/index.js')
const { rentalRouter } = require('./services/rentals/routes/index.js')

// Strip '$' operators out of query filters, so `?genre[$ne]=x` can't become a MongoDB operator.
mongoose.set('sanitizeFilter', true)

/**
 * Builds the Express app without listening, so tests can use it with supertest.
 * @param {{authConfig?: ReturnType<typeof loadAuthConfig>}} [options]
 * @returns {import('express').Express}
 */
function buildApp(options = {}) {
    const authConfig = options.authConfig ?? loadAuthConfig(process.env)
    const { publicRouters, adminRouter } = buildPlatformRouters(authConfig)

    const app = express()
    app.disable('x-powered-by')
    app.use(serverTiming)
    app.use(express.json({ limit: '10mb' }))

    // Public: /health and (if enabled) POST /auth/token
    app.use(publicRouters)

    // Everything under /api needs 'Authorization: Bearer <token>'.
    app.use('/api', requireAuth(authConfig))
    app.use('/api/admin', adminRouter)
    app.use('/api/movies', movieStoreRouter)
    app.use('/api/employees', employeeRouter)
    app.use('/api/rentals', rentalRouter)

    app.use(notFound)
    app.use(errorHandler)
    return app
}

module.exports = { buildApp }

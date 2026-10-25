const { healthRouter } = require('./health.routes.js')
const { buildAuthRouter } = require('./auth.routes.js')
const { overviewRouter } = require('./overview.routes.js')

/**
 * Cross-cutting routes that belong to no single domain.
 * Public routes need no token; the admin router is mounted behind requireAuth in app.js.
 * @param {{secret: Uint8Array, expiresIn: string, devTokenEndpoint: boolean}} authConfig
 */
function buildPlatformRouters(authConfig) {
    const publicRouters = [healthRouter]
    if (authConfig.devTokenEndpoint) publicRouters.push(buildAuthRouter(authConfig))
    return { publicRouters, adminRouter: overviewRouter }
}

module.exports = { buildPlatformRouters }

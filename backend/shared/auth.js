// SOURCE OF TRUTH: /shared/auth.js. Do not edit copies under services/*/shared — run "make sync".
const { SignJWT, jwtVerify } = require('jose')
const { HttpError } = require('./errors.js')

// Tokens are signed and checked with these values, so a token for another app is rejected.
const TOKEN_ISSUER = 'movie-store'
const TOKEN_AUDIENCE = 'movie-store-api'
const ALGORITHM = 'HS256'
const MIN_SECRET_LENGTH = 32

/**
 * Read and check the JWT settings. Throws at startup rather than failing on the first request.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{secret: Uint8Array, expiresIn: string, devTokenEndpoint: boolean}}
 */
function loadAuthConfig(env = process.env) {
    const rawSecret = env.JWT_SECRET ?? ''
    if (rawSecret.length < MIN_SECRET_LENGTH) {
        throw new Error(
            `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
        )
    }
    return {
        secret: new TextEncoder().encode(rawSecret),
        expiresIn: env.JWT_EXPIRES_IN || '1h',
        devTokenEndpoint: env.DEV_TOKEN_ENDPOINT === 'true',
    }
}

/**
 * Create a signed access token. There are no user accounts: the subject is just a label.
 * @param {{secret: Uint8Array, expiresIn: string}} config
 * @param {string} [subject]
 * @returns {Promise<string>}
 */
function signAccessToken(config, subject = 'demo') {
    return new SignJWT({ scope: 'api' })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(subject)
        .setIssuer(TOKEN_ISSUER)
        .setAudience(TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(config.expiresIn)
        .sign(config.secret)
}

/**
 * Express middleware: requires 'Authorization: Bearer <token>' and verifies it.
 * On success the token claims are available as req.auth.
 * @param {{secret: Uint8Array}} config
 */
function requireAuth(config) {
    return async function checkBearerToken(req, _res, next) {
        const header = req.get('authorization') ?? ''
        const [scheme, token] = header.split(' ')
        if (scheme !== 'Bearer' || !token) {
            return next(new HttpError(401, "Missing token. Send 'Authorization: Bearer <access token>'."))
        }
        try {
            const { payload } = await jwtVerify(token, config.secret, {
                algorithms: [ALGORITHM],
                issuer: TOKEN_ISSUER,
                audience: TOKEN_AUDIENCE,
            })
            req.auth = payload
            next()
        } catch (error) {
            // jose error codes look like 'ERR_JWT_EXPIRED'; we report the reason, never the token.
            const reason = error.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token'
            next(new HttpError(401, reason))
        }
    }
}

module.exports = { TOKEN_ISSUER, TOKEN_AUDIENCE, loadAuthConfig, signAccessToken, requireAuth }

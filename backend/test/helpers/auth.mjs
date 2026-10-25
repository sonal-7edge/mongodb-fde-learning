import { createRequire } from 'node:module'
import { SignJWT } from 'jose'
import supertest from 'supertest'

const require = createRequire(import.meta.url)
const { TOKEN_AUDIENCE, TOKEN_ISSUER } = require('../../shared/auth.js')

const encoder = new TextEncoder()

/**
 * Sign a token the way the app does, with knobs to make it invalid on purpose.
 * @param {{secret?: string, expiresIn?: string|number, issuer?: string, audience?: string}} [overrides]
 * @returns {Promise<string>}
 */
export async function signTestToken(overrides = {}) {
    return new SignJWT({ scope: 'api' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('test')
        .setIssuer(overrides.issuer ?? TOKEN_ISSUER)
        .setAudience(overrides.audience ?? TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(overrides.expiresIn ?? '5m')
        .sign(encoder.encode(overrides.secret ?? process.env.JWT_SECRET))
}

/**
 * supertest agent whose requests all carry a valid Bearer token.
 * Usage: const api = await authedApi(app); await api.get('/api/admin/overview')
 * @param {import('express').Express} app
 */
export async function authedApi(app) {
    const header = `Bearer ${await signTestToken()}`
    const request = supertest(app)
    const withAuth = (method) => (url) => request[method](url).set('Authorization', header)
    return { get: withAuth('get'), post: withAuth('post'), patch: withAuth('patch'), delete: withAuth('delete') }
}

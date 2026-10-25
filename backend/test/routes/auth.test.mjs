import { createRequire } from 'node:module'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectTestDb, disconnectTestDb } from '../helpers/db.mjs'
import { signTestToken } from '../helpers/auth.mjs'

const require = createRequire(import.meta.url)
const { buildApp } = require('../../app.js')
const { loadAuthConfig } = require('../../shared/auth.js')

const PROTECTED = '/api/admin/overview'

describe('JWT authorizer on /api/*', () => {
    const app = buildApp()
    beforeAll(connectTestDb)
    afterAll(disconnectTestDb)

    it('rejects a request with no Authorization header (401)', async () => {
        const res = await supertest(app).get(PROTECTED)
        expect(res.status).toBe(401)
        expect(res.body.error).toMatch(/Missing token/)
    })

    it('rejects a non-Bearer scheme (401)', async () => {
        const res = await supertest(app).get(PROTECTED).set('Authorization', 'Basic abc')
        expect(res.status).toBe(401)
    })

    it('rejects a token signed with another secret (401)', async () => {
        const token = await signTestToken({ secret: 'a-completely-different-secret-of-32-chars!!' })
        const res = await supertest(app).get(PROTECTED).set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Invalid token')
    })

    it('rejects an expired token (401)', async () => {
        const token = await signTestToken({ expiresIn: Math.floor(Date.now() / 1000) - 60 })
        const res = await supertest(app).get(PROTECTED).set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Token expired')
    })

    it('rejects a token for another audience (401)', async () => {
        const token = await signTestToken({ audience: 'someone-else' })
        const res = await supertest(app).get(PROTECTED).set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(401)
    })

    it('accepts a valid token (200)', async () => {
        const token = await signTestToken()
        const res = await supertest(app).get(PROTECTED).set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(200)
        expect(res.body.collections).toHaveLength(3)
        expect(res.body.total.freeTierBytes).toBe(512 * 1024 * 1024)
    })

    it('POST /auth/token issues a token that works on /api', async () => {
        const issued = await supertest(app).post('/auth/token').send({ label: 'frontend' })
        expect(issued.status).toBe(201)
        expect(issued.body).toMatchObject({ token_type: 'Bearer', expires_in: '1h' })

        const res = await supertest(app).get(PROTECTED).set('Authorization', `Bearer ${issued.body.access_token}`)
        expect(res.status).toBe(200)
    })

    it('POST /auth/token rejects an invalid body with a Joi 400', async () => {
        const res = await supertest(app).post('/auth/token').send({ label: '' })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('Invalid request')
        expect(res.body.details[0].path).toBe('label')
    })

    it('POST /auth/token does not exist when DEV_TOKEN_ENDPOINT is off', async () => {
        const locked = buildApp({ authConfig: loadAuthConfig({ ...process.env, DEV_TOKEN_ENDPOINT: 'false' }) })
        const res = await supertest(locked).post('/auth/token').send({})
        expect(res.status).toBe(404)
    })

    it('every employee, movie and rental endpoint requires a token (auth is added per route in app.js)', async () => {
        const id = '64b000000000000000000000'
        const endpoints = [
            ['post', '/api/employees/admin/seed'], ['post', '/api/employees'], ['get', '/api/employees'],
            ['get', `/api/employees/${id}`], ['patch', `/api/employees/${id}`], ['delete', `/api/employees/${id}`],
            ['post', '/api/movies/admin/seed'], ['post', '/api/movies'], ['post', '/api/movies/bulk'],
            ['get', '/api/movies'], ['get', '/api/movies/count'], ['get', '/api/movies/genres'],
            ['patch', '/api/movies'], ['delete', '/api/movies'], ['get', `/api/movies/${id}`],
            ['patch', `/api/movies/${id}`], ['post', `/api/movies/${id}/stock`], ['delete', `/api/movies/${id}`],
            ['post', '/api/rentals'], ['get', '/api/rentals'], ['get', `/api/rentals/${id}`], ['post', `/api/rentals/${id}/return`],
        ]
        for (const [method, path] of endpoints) {
            const res = await supertest(app)[method](path).send({})
            expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401)
        }
    })

    it('refuses to start with a short JWT_SECRET', () => {
        expect(() => loadAuthConfig({ JWT_SECRET: 'too-short' })).toThrow(/at least 32 characters/)
    })
})

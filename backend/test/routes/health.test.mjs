import { createRequire } from 'node:module'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectTestDb, disconnectTestDb } from '../helpers/db.mjs'

const require = createRequire(import.meta.url)
const { buildApp } = require('../../app.js')

describe('GET /health', () => {
    const app = buildApp()
    beforeAll(connectTestDb)
    afterAll(disconnectTestDb)

    it('returns 200 without a token when MongoDB is connected', async () => {
        const res = await supertest(app).get('/health')
        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ status: 'ok', db: 'connected', app: 'movie-store' })
    })

    it('adds a Server-Timing header so clients can see server time', async () => {
        const res = await supertest(app).get('/health')
        expect(res.headers['server-timing']).toMatch(/^app;dur=\d+(\.\d+)?$/)
    })

    it('returns JSON 404 for unknown routes', async () => {
        const res = await supertest(app).get('/nope')
        expect(res.status).toBe(404)
        expect(res.body.error).toMatch(/No route/)
    })
})

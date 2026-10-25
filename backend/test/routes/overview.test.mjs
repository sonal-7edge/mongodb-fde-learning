import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectTestDb, disconnectTestDb } from '../helpers/db.mjs'
import { authedApi } from '../helpers/auth.mjs'

const require = createRequire(import.meta.url)
const mongoose = require('mongoose')
const { buildApp } = require('../../app.js')

describe('GET /api/admin/overview', () => {
    let api
    beforeAll(async () => {
        await connectTestDb()
        api = await authedApi(buildApp())
    })
    afterAll(disconnectTestDb)

    it('names collections by STAGE (STAGE=test in vitest.config.mjs)', async () => {
        const res = await api.get('/api/admin/overview')
        expect(res.body.collections.map((c) => c.collection)).toEqual(['test-movies', 'test-employees', 'test-rentals'])
    })

    it("reports zeros for collections that don't exist yet", async () => {
        const res = await api.get('/api/admin/overview')
        expect(res.status).toBe(200)
        for (const collection of res.body.collections) expect(collection.count).toBe(0)
    })

    it('reports counts and sizes once a collection has documents', async () => {
        await mongoose.connection.db.collection('test-movies').insertMany([{ title: 'A' }, { title: 'B' }])
        const res = await api.get('/api/admin/overview')
        const movies = res.body.collections.find((c) => c.collection === 'test-movies')
        expect(movies.count).toBe(2)
        expect(movies.dataSize).toBeGreaterThan(0)
        expect(res.body.total.usedBytes).toBeGreaterThan(0)
    })

    it('creates no indexes besides _id (indexes are added deliberately, never automatically)', async () => {
        const res = await api.get('/api/admin/overview')
        const movies = res.body.collections.find((c) => c.collection === 'test-movies')
        expect(Object.keys(movies.indexSizes)).toEqual(['_id_'])
    })
})

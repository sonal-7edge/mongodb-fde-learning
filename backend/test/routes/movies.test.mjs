import { createRequire } from 'node:module'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clearCollections, connectTestDb, disconnectTestDb } from '../helpers/db.mjs'
import { authedApi } from '../helpers/auth.mjs'

const require = createRequire(import.meta.url)
const { buildApp } = require('../../app.js')

const DRAMA = { title: 'Space Adventure', kind: 'movie', genres: ['Drama', 'sci-fi'], year: 2001, rating: 8.1, inventory: { total: 1, available: 1 } }
const COMEDY = { title: 'Laugh Lines', kind: 'series', genres: ['comedy'], year: 2015, rating: 6.4 }

describe('movie_store CRUD (one controller per MongoDB operation)', () => {
    let api
    beforeAll(async () => {
        await connectTestDb()
        api = await authedApi(buildApp())
    })
    beforeEach(clearCollections)
    afterAll(disconnectTestDb)

    it('insertOne: creates a movie, lowercases genres and fills defaults', async () => {
        const res = await api.post('/api/movies').send(DRAMA)
        expect(res.status).toBe(201)
        expect(res.body.operation).toBe('insertOne')
        expect(res.body.data).toMatchObject({ title: 'Space Adventure', genres: ['drama', 'sci-fi'], deleted: false, created_by: 'test' })
        expect(res.body.data.source).toMatchObject({ provider: 'manual' })
        expect(res.body.data.created_at).toBeTruthy()
    })

    it('insertOne: rejects an invalid body with a Joi 400 listing every problem', async () => {
        const res = await api.post('/api/movies').send({ kind: 'podcast', rating: 11 })
        expect(res.status).toBe(400)
        expect(res.body.details.map((d) => d.path).sort()).toEqual(['kind', 'rating', 'title'])
    })

    it('insertMany: inserts several movies in one call', async () => {
        const res = await api.post('/api/movies/bulk').send({ movies: [DRAMA, COMEDY] })
        expect(res.status).toBe(201)
        expect(res.body).toMatchObject({ operation: 'insertMany', inserted_count: 2 })
    })

    it('find: filters by genre (array contains), sorts by rating and shows a COLLSCAN plan', async () => {
        await api.post('/api/movies/bulk').send({ movies: [DRAMA, COMEDY] })
        const res = await api.get('/api/movies?genre=drama&explain=true')
        expect(res.status).toBe(200)
        expect(res.body.data.map((m) => m.title)).toEqual(['Space Adventure'])
        // No indexes exist yet, so MongoDB reads every document
        expect(res.body.plan).toMatchObject({ stage: 'COLLSCAN', docsExamined: 2, hasSortStage: true })
    })

    it('find: pages with a cursor instead of skip', async () => {
        const movies = Array.from({ length: 5 }, (_, i) => ({ ...COMEDY, title: `M${i}`, rating: i + 1 }))
        await api.post('/api/movies/bulk').send({ movies })
        const page1 = await api.get('/api/movies?limit=2')
        expect(page1.body.data.map((m) => m.rating)).toEqual([5, 4])
        const page2 = await api.get(`/api/movies?limit=2&cursor=${page1.body.next_cursor}`)
        expect(page2.body.data.map((m) => m.rating)).toEqual([3, 2])
    })

    it('blocks query-operator injection: ?genre[$ne]=x is an unknown key (400)', async () => {
        const res = await api.get('/api/movies?genre[$ne]=x')
        expect(res.status).toBe(400)
    })

    it('countDocuments and distinct', async () => {
        await api.post('/api/movies/bulk').send({ movies: [DRAMA, COMEDY] })
        expect((await api.get('/api/movies/count?kind=series')).body).toMatchObject({ operation: 'countDocuments', count: 1 })
        expect((await api.get('/api/movies/genres')).body.data).toEqual(['comedy', 'drama', 'sci-fi'])
    })

    it('findOne: 200, malformed id 400, unknown id 404', async () => {
        const { body } = await api.post('/api/movies').send(DRAMA)
        expect((await api.get(`/api/movies/${body.data._id}`)).status).toBe(200)
        const malformed = await api.get('/api/movies/not-an-id')
        expect(malformed.status).toBe(400)
        expect(malformed.body.details[0].message).toMatch(/24-character MongoDB ObjectId/)
        expect((await api.get('/api/movies/64b000000000000000000000')).status).toBe(404)
    })

    it('updateOne: merges nested price instead of replacing it, and reports counts', async () => {
        const { body } = await api.post('/api/movies').send({ ...DRAMA, price: { rent: 2, buy: 10, currency: 'USD' } })
        const res = await api.patch(`/api/movies/${body.data._id}`).send({ price: { rent: 3 } })
        expect(res.body.result).toMatchObject({ matchedCount: 1, modifiedCount: 1 })
        const after = await api.get(`/api/movies/${body.data._id}`)
        expect(after.body.data.price).toEqual({ rent: 3, buy: 10, currency: 'USD' })
    })

    it('updateOne: inventory is not a whitelisted PATCH field', async () => {
        const { body } = await api.post('/api/movies').send(DRAMA)
        const res = await api.patch(`/api/movies/${body.data._id}`).send({ inventory: { total: 99, available: 99 } })
        expect(res.status).toBe(400)
    })

    it('updateMany: changes every matching movie and needs at least one filter', async () => {
        await api.post('/api/movies/bulk').send({ movies: [DRAMA, { ...DRAMA, title: 'Two' }, COMEDY] })
        const res = await api.patch('/api/movies').send({ filter: { genre: 'drama' }, set: { price: { rent: 1.5 } } })
        expect(res.body.result).toMatchObject({ matchedCount: 2, modifiedCount: 2 })
        expect((await api.patch('/api/movies').send({ filter: {}, set: { language: 'en' } })).status).toBe(400)
    })

    it('findOneAndUpdate: takes the last copy once, then 409 Out of stock; return refills', async () => {
        const { body } = await api.post('/api/movies').send(DRAMA) // 1 copy
        const id = body.data._id
        const first = await api.post(`/api/movies/${id}/stock`).send({ action: 'take' })
        expect(first.body.data.inventory.available).toBe(0)
        const second = await api.post(`/api/movies/${id}/stock`).send({ action: 'take' })
        expect(second.status).toBe(409)
        expect(second.body.error).toBe('Out of stock')
        expect((await api.post(`/api/movies/${id}/stock`).send({ action: 'return' })).body.data.inventory.available).toBe(1)
        expect((await api.post(`/api/movies/${id}/stock`).send({ action: 'return' })).status).toBe(409)
    })

    it('findOneAndUpdate: 10 parallel takes on 3 copies → exactly 3 succeed', async () => {
        const { body } = await api.post('/api/movies').send({ ...DRAMA, inventory: { total: 3, available: 3 } })
        const results = await Promise.all(
            Array.from({ length: 10 }, () => api.post(`/api/movies/${body.data._id}/stock`).send({ action: 'take' })),
        )
        expect(results.filter((r) => r.status === 200)).toHaveLength(3)
        expect(results.filter((r) => r.status === 409)).toHaveLength(7)
    })

    it('soft delete hides the movie; deleteMany purges soft-deleted ones', async () => {
        const { body } = await api.post('/api/movies').send(DRAMA)
        await api.post('/api/movies').send(COMEDY)
        expect((await api.delete(`/api/movies/${body.data._id}`)).body.result).toMatchObject({ matchedCount: 1 })
        expect((await api.get(`/api/movies/${body.data._id}`)).status).toBe(404)
        expect((await api.get('/api/movies/count')).body.count).toBe(1)
        expect((await api.delete('/api/movies')).body.result).toMatchObject({ deletedCount: 1 })
    })

    it('by-title: prefix search is a COLLSCAN without an index and an IXSCAN with { title: 1 }', async () => {
        await api.post('/api/movies/bulk').send({ movies: [DRAMA, { ...DRAMA, title: 'Space Cowboys' }, COMEDY] })

        const before = await api.get('/api/movies/by-title?title=Space&explain=true')
        expect(before.status).toBe(200)
        expect(before.body.data.map((m) => m.title)).toEqual(['Space Adventure', 'Space Cowboys'])
        expect(before.body.plan).toMatchObject({ stage: 'COLLSCAN', docsExamined: 3, hasSortStage: true })

        expect((await api.post('/api/movies/admin/indexes/title')).status).toBe(201)
        const listed = await api.get('/api/movies/admin/indexes')
        expect(listed.body.data.map((i) => i.name)).toEqual(['_id_', 'title_1'])

        const after = await api.get('/api/movies/by-title?title=Space&explain=true')
        expect(after.body.data.map((m) => m.title)).toEqual(['Space Adventure', 'Space Cowboys'])
        expect(after.body.plan).toMatchObject({ stage: 'IXSCAN', indexName: 'title_1', docsExamined: 2, hasSortStage: false })

        expect((await api.delete('/api/movies/admin/indexes/title')).status).toBe(200)
        expect((await api.delete('/api/movies/admin/indexes/title')).status).toBe(404)
    })

    it('find, count and distinct: title prefix filter and ?explain=true plans', async () => {
        await api.post('/api/movies/bulk').send({ movies: [DRAMA, { ...DRAMA, title: 'Space Cowboys', genres: ['action'] }, COMEDY] })

        const found = await api.get('/api/movies?title=Space&explain=true')
        expect(found.body.data.map((m) => m.title).sort()).toEqual(['Space Adventure', 'Space Cowboys'])
        expect(found.body.plan).toMatchObject({ stage: 'COLLSCAN', docsExamined: 3 })

        const counted = await api.get('/api/movies/count?title=Space&explain=true')
        expect(counted.body.count).toBe(2)
        expect(counted.body.plan).toMatchObject({ stage: 'COLLSCAN', docsExamined: 3 })

        await api.post('/api/movies/admin/indexes/title')
        expect((await api.get('/api/movies?title=Space&explain=true')).body.plan).toMatchObject({ stage: 'IXSCAN', indexName: 'title_1' })
        const countedWithIndex = await api.get('/api/movies/count?title=Space&explain=true')
        expect(countedWithIndex.body).toMatchObject({ count: 2, plan: { indexName: 'title_1' } })

        const genres = await api.get('/api/movies/genres?explain=true')
        expect(genres.body.data).toEqual(['action', 'comedy', 'drama', 'sci-fi'])
        expect(genres.body.plan).toMatchObject({ stage: 'COLLSCAN', docsExamined: 3 })
    })

    it('by-title: treats the text literally and only allows known index names', async () => {
        await api.post('/api/movies').send({ ...DRAMA, title: 'A.I.' })
        await api.post('/api/movies').send({ ...DRAMA, title: 'ABIX' })
        expect((await api.get('/api/movies/by-title?title=A.I')).body.data.map((m) => m.title)).toEqual(['A.I.'])
        expect((await api.get('/api/movies/by-title')).status).toBe(400)
        expect((await api.post('/api/movies/admin/indexes/rating')).status).toBe(400)
    })

    it('seed: inserts N movies in batches, repeatably', async () => {
        const res = await api.post('/api/movies/admin/seed').send({ count: 250, batch_size: 100, seed: 7 })
        expect(res.status).toBe(201)
        expect(res.body).toMatchObject({ collection: 'test-movies', inserted: 250 })
        expect(res.body.budget.allowed).toBe(true)
        expect((await api.get('/api/movies/count')).body.count).toBe(250)
    })
})

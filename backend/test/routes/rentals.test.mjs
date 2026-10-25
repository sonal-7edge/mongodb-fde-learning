import { createRequire } from 'node:module'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clearCollections, connectTestDb, disconnectTestDb } from '../helpers/db.mjs'
import { authedApi } from '../helpers/auth.mjs'

const require = createRequire(import.meta.url)
const { buildApp } = require('../../app.js')

const CUSTOMER = { name: 'Ravi Kumar', email: 'Ravi@Example.com', phone: '+91 98450 00000' }
const MISSING_ID = '64b000000000000000000000'

describe('rentals: a person rents a movie, served by an employee', () => {
    let api

    /** Create a movie with `copies` copies (and a rent price unless price is null). */
    const createMovie = async (copies, price = { rent: 2.5, currency: 'USD' }) => {
        const body = { title: 'Space Adventure', kind: 'movie', year: 2001, inventory: { total: copies, available: copies } }
        if (price) body.price = price
        return (await api.post('/api/movies').send(body)).body.data
    }
    const createEmployee = async () =>
        (await api.post('/api/employees').send({ first_name: 'Asha', last_name: 'Rao', email: 'asha@example.com' })).body.data
    const rent = (movie_id, employee_id, days = 3) =>
        api.post('/api/rentals').send({ movie_id, employee_id, customer: CUSTOMER, days })
    const stockOf = async (id) => (await api.get(`/api/movies/${id}`)).body.data.inventory.available

    beforeAll(async () => {
        await connectTestDb()
        api = await authedApi(buildApp())
    })
    beforeEach(clearCollections)
    afterAll(disconnectTestDb)

    it('rents a movie: snapshots, computed price, due date, stock -1, rental_count +1', async () => {
        const movie = await createMovie(2)
        const employee = await createEmployee()
        const res = await rent(movie._id, employee._id, 4)
        expect(res.status).toBe(201)
        const rental = res.body.data
        expect(rental).toMatchObject({
            status: 'active',
            movie: { _id: movie._id, title: 'Space Adventure', kind: 'movie', year: 2001 },
            employee: { _id: employee._id, name: 'Asha Rao', employee_code: employee.employee_code },
            customer: { name: 'Ravi Kumar', email: 'ravi@example.com' },
            pricing: { daily_rate: 2.5, days: 4, total: 10, currency: 'USD' },
        })
        expect(rental.rental_code).toMatch(/^RNT-[0-9A-F]{8}$/)
        expect(new Date(rental.due_at) - new Date(rental.rented_at)).toBe(4 * 24 * 60 * 60 * 1000)
        const after = (await api.get(`/api/movies/${movie._id}`)).body.data
        expect(after.inventory.available).toBe(1)
        expect(after.stats.rental_count).toBe(1)
    })

    it('needs an existing employee: 404, and the copy is NOT taken (transaction rolled back)', async () => {
        const movie = await createMovie(1)
        const res = await rent(movie._id, MISSING_ID)
        expect(res.status).toBe(404)
        expect(res.body.error).toBe('Employee not found')
        expect(await stockOf(movie._id)).toBe(1)
        expect((await api.get('/api/rentals')).body.total_docs).toBe(0)
    })

    it('a soft-deleted employee cannot serve a rental', async () => {
        const movie = await createMovie(1)
        const employee = await createEmployee()
        await api.delete(`/api/employees/${employee._id}`)
        expect((await rent(movie._id, employee._id)).status).toBe(404)
    })

    it('a movie without a rent price: 409, and the stock change is rolled back', async () => {
        const movie = await createMovie(1, null)
        const employee = await createEmployee()
        const res = await rent(movie._id, employee._id)
        expect(res.status).toBe(409)
        expect(res.body.error).toBe('This movie has no rental price')
        expect(await stockOf(movie._id)).toBe(1)
    })

    it('renting a 1-copy movie twice: the second gets 409 Out of stock', async () => {
        const movie = await createMovie(1)
        const employee = await createEmployee()
        expect((await rent(movie._id, employee._id)).status).toBe(201)
        const second = await rent(movie._id, employee._id)
        expect(second.status).toBe(409)
        expect(second.body.error).toBe('Out of stock')
    })

    it('unknown movie → 404; malformed ids → 400', async () => {
        const employee = await createEmployee()
        expect((await rent(MISSING_ID, employee._id)).status).toBe(404)
        const bad = await rent('abc', 'xyz')
        expect(bad.status).toBe(400)
        expect([...new Set(bad.body.details.map((d) => d.path))].sort()).toEqual(['employee_id', 'movie_id'])
    })

    it('30 parallel rentals of a movie with 5 copies → exactly 5 succeed', async () => {
        const movie = await createMovie(5)
        const employee = await createEmployee()
        const results = await Promise.all(Array.from({ length: 30 }, () => rent(movie._id, employee._id)))
        expect(results.filter((r) => r.status === 201)).toHaveLength(5)
        expect(results.filter((r) => r.status === 409)).toHaveLength(25)
        expect(await stockOf(movie._id)).toBe(0)
        expect((await api.get('/api/rentals')).body.total_docs).toBe(5)
    })

    it('return: marks returned, adds an event, puts the copy back; returning twice → 409', async () => {
        const movie = await createMovie(1)
        const employee = await createEmployee()
        const rental = (await rent(movie._id, employee._id)).body.data
        const res = await api.post(`/api/rentals/${rental._id}/return`)
        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe('returned')
        expect(res.body.data.events.map((e) => e.type)).toEqual(['rented', 'returned'])
        expect(await stockOf(movie._id)).toBe(1)
        const again = await api.post(`/api/rentals/${rental._id}/return`)
        expect(again.status).toBe(409)
        expect(again.body.error).toBe('Already returned')
        expect((await api.post(`/api/rentals/${MISSING_ID}/return`)).status).toBe(404)
    })

    it('the snapshot does not change when the movie is renamed', async () => {
        const movie = await createMovie(1)
        const employee = await createEmployee()
        const rental = (await rent(movie._id, employee._id)).body.data
        await api.patch(`/api/movies/${movie._id}`).send({ title: 'Renamed' })
        expect((await api.get(`/api/rentals/${rental._id}`)).body.data.movie.title).toBe('Space Adventure')
    })

    it('list filters by status, customer email and employee', async () => {
        const movie = await createMovie(3)
        const employee = await createEmployee()
        const first = (await rent(movie._id, employee._id)).body.data
        await rent(movie._id, employee._id)
        await api.post(`/api/rentals/${first._id}/return`)
        expect((await api.get('/api/rentals?status=active')).body.total_docs).toBe(1)
        expect((await api.get('/api/rentals?customer_email=ravi@example.com')).body.total_docs).toBe(2)
        expect((await api.get(`/api/rentals?employee_id=${employee._id}`)).body.total_docs).toBe(2)
    })
})

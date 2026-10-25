import { createRequire } from 'node:module'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clearCollections, connectTestDb, disconnectTestDb } from '../helpers/db.mjs'
import { authedApi } from '../helpers/auth.mjs'

const require = createRequire(import.meta.url)
const { buildApp } = require('../../app.js')

const ASHA = { first_name: 'Asha', last_name: 'Rao', email: 'Asha.Rao@Example.com', department: 'Sales', location: { city: 'Pune', country: 'India' } }

describe('employee_management CRUD (one operation on one record)', () => {
    let api
    beforeAll(async () => {
        await connectTestDb()
        api = await authedApi(buildApp())
    })
    beforeEach(clearCollections)
    afterAll(disconnectTestDb)

    it('create → get → update → delete', async () => {
        const created = await api.post('/api/employees').send(ASHA)
        expect(created.status).toBe(201)
        expect(created.body.data).toMatchObject({ email: 'asha.rao@example.com', deleted: false, created_by: 'test' })
        expect(created.body.data.employee_code).toMatch(/^EMP-[0-9A-F]{8}$/)
        const id = created.body.data._id

        expect((await api.get(`/api/employees/${id}`)).body.data.first_name).toBe('Asha')

        const updated = await api.patch(`/api/employees/${id}`).send({ job_title: 'Store Manager', location: { city: 'Mumbai' } })
        expect(updated.status).toBe(200)
        // location.country kept: the update merged into location instead of replacing it
        expect(updated.body.data).toMatchObject({ job_title: 'Store Manager', location: { city: 'Mumbai', country: 'India' }, updated_by: 'test' })

        expect((await api.delete(`/api/employees/${id}`)).status).toBe(200)
        expect((await api.get(`/api/employees/${id}`)).status).toBe(404)
        expect((await api.delete(`/api/employees/${id}`)).status).toBe(404)
    })

    it('rejects a bad email and server-owned fields (400)', async () => {
        expect((await api.post('/api/employees').send({ ...ASHA, email: 'not-an-email' })).status).toBe(400)
        expect((await api.post('/api/employees').send({ ...ASHA, employee_code: 'EMP-HACKED' })).status).toBe(400)
    })

    it('malformed id → 400, unknown id → 404', async () => {
        expect((await api.get('/api/employees/123')).status).toBe(400)
        expect((await api.patch('/api/employees/64b000000000000000000000').send({ job_title: 'X' })).status).toBe(404)
    })

    it('get with ?explain=true finds by _id without scanning the collection', async () => {
        const { body } = await api.post('/api/employees').send(ASHA)
        const res = await api.get(`/api/employees/${body.data._id}?explain=true`)
        expect(res.body.plan.docsExamined).toBeLessThanOrEqual(1)
        expect(res.body.plan.stage).not.toBe('COLLSCAN')
    })

    it('list pages with snake_case labels and filters by department', async () => {
        await api.post('/api/employees/admin/seed').send({ count: 30, seed: 1 })
        await api.post('/api/employees').send(ASHA)
        const page = await api.get('/api/employees?limit=10&page=2')
        expect(page.body).toMatchObject({ total_docs: 31, page: 2, total_pages: 4, has_next_page: true })
        expect(page.body.data).toHaveLength(10)
        const sales = await api.get('/api/employees?department=Sales')
        expect(sales.body.data.every((e) => e.department === 'Sales')).toBe(true)
    })

    it('seed: same seed → same employees', async () => {
        await api.post('/api/employees/admin/seed').send({ count: 3, seed: 99 })
        const first = (await api.get('/api/employees?limit=3')).body.data.map((e) => e.employee_code).sort()
        await clearCollections()
        await api.post('/api/employees/admin/seed').send({ count: 3, seed: 99 })
        const second = (await api.get('/api/employees?limit=3')).body.data.map((e) => e.employee_code).sort()
        expect(second).toEqual(first)
    })
})

import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectTestDb, disconnectTestDb } from '../helpers/db.mjs'

const require = createRequire(import.meta.url)
const mongoose = require('mongoose')
const { summarizeExplain } = require('../../shared/explain.js')

// Checks shared/explain.js against REAL explain output from the MongoDB version under test.
describe('summarizeExplain', () => {
    let things

    beforeAll(async () => {
        await connectTestDb()
        things = mongoose.connection.db.collection('explain_things')
        await things.insertMany(Array.from({ length: 200 }, (_, i) => ({ group: i % 10, score: i })))
    })
    afterAll(disconnectTestDb)

    it('reports COLLSCAN and an in-memory SORT when no index exists', async () => {
        const output = await things.find({ group: 3 }).sort({ score: -1 }).explain('executionStats')
        const plan = summarizeExplain(output)
        expect(plan.stage).toBe('COLLSCAN')
        expect(plan.indexName).toBeNull()
        expect(plan.docsExamined).toBe(200)
        expect(plan.nReturned).toBe(20)
        expect(plan.hasSortStage).toBe(true)
    })

    it('reports IXSCAN, the index name and no SORT with a matching compound index', async () => {
        await things.createIndex({ group: 1, score: -1 }, { name: 'group_score' })
        const output = await things.find({ group: 3 }).sort({ score: -1 }).explain('executionStats')
        const plan = summarizeExplain(output)
        expect(plan.stage).toBe('IXSCAN')
        expect(plan.indexName).toBe('group_score')
        expect(plan.docsExamined).toBe(20)
        expect(plan.keysExamined).toBe(20)
        expect(plan.hasSortStage).toBe(false)
    })

    it('understands aggregate() explain output', async () => {
        const output = await things
            .aggregate([{ $match: { group: 3 } }, { $group: { _id: null, n: { $sum: 1 } } }])
            .explain('executionStats')
        const plan = summarizeExplain(output)
        expect(plan.indexName).toBe('group_score')
    })
})

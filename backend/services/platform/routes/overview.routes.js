const { Router } = require('express')
const Movie = require('../entities/Movie.js')
const Employee = require('../entities/Employee.js')
const Rental = require('../entities/Rental.js')
const { FREE_TIER_BYTES, collectionStats, percentOfFreeTier } = require('../shared/admin.js')

const overviewRouter = Router()

// GET /api/admin/overview — size of every collection, and the total against the Free tier's 0.5 GB.
overviewRouter.get('/overview', async (_req, res) => {
    const collections = await Promise.all([Movie, Employee, Rental].map(collectionStats))
    const usedBytes = collections.reduce((sum, c) => sum + c.dataSize + c.totalIndexSize, 0)
    res.json({
        collections,
        total: {
            usedBytes,
            freeTierBytes: FREE_TIER_BYTES,
            percentOfFreeTier: percentOfFreeTier(usedBytes),
        },
    })
})

module.exports = { overviewRouter }

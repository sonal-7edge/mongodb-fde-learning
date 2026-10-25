/**
 * @import : External Dependencies
 */
const { faker } = require('@faker-js/faker')

/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { seedInBatches } = require('../shared/seed')
const { fakeMovie } = require('../utils/helpers')

/**
 * Seed Movies | Movie Store
 * @description -- Inserts `count` synthetic movies in batches (insertMany), after a Free tier storage check.
 *                 The same `seed` always generates the same movies.
 * @route       -- POST /api/movies/admin/seed   body: { count, batch_size?, seed? }
 * @access      -- (Bearer token)
 * @apiSuccess  -- (201) {Object} { collection, inserted, ms, docs_per_sec, budget }
 * @apiError    -- (507) The seed would push the database past 80% of the Free tier's 0.5 GB
 */
module.exports.seedMovies = async (req, res, next) => {
    try {
        const { count, batch_size, seed } = req.valid.body
        faker.seed(seed)
        const result = await seedInBatches({
            model: Movie,
            count,
            batchSize: batch_size,
            makeDoc: () => fakeMovie(`seed:${req.auth.sub}`),
        })
        return res.status(201).json({ operation: 'insertMany (batched)', ...result })
    } catch (error) {
        return next(error)
    }
}

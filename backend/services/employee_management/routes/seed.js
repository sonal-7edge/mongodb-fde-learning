/**
 * @import : External Dependencies
 */
const { faker } = require('@faker-js/faker')

/**
 * @import : Entities
 */
const Employee = require('../entities/Employee')

/**
 * @import : Common Helpers
 */
const { seedInBatches } = require('../shared/seed')
const { fakeEmployee } = require('../utils/helpers')

/**
 * Seed Employees | Employee Management
 * @description -- Inserts `count` synthetic employees in batches (insertMany), after a Free tier storage check
 * @route       -- POST /api/employees/admin/seed   body: { count, batch_size?, seed? }
 * @access      -- (Bearer token)
 * @apiSuccess  -- (201) {Object} { collection, inserted, ms, docs_per_sec, budget }
 * @apiError    -- (507) The seed would push the database past 80% of the Free tier's 0.5 GB
 */
module.exports.seedEmployees = async (req, res, next) => {
    try {
        const { count, batch_size, seed } = req.valid.body
        faker.seed(seed)
        const result = await seedInBatches({
            model: Employee,
            count,
            batchSize: batch_size,
            makeDoc: () => fakeEmployee(`seed:${req.auth.sub}`),
        })
        return res.status(201).json(result)
    } catch (error) {
        return next(error)
    }
}

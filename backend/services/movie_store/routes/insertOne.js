/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * Create Movie | Movie Store
 * @description -- Inserts ONE movie (Model.create → insertOne)
 * @route       -- POST /api/movies
 * @access      -- (Bearer token)
 * @apiSuccess  -- (201) {Object} The stored movie, with defaults filled in (inventory, deleted, timestamps...)
 */
module.exports.createMovie = async (req, res, next) => {
    try {
        const movie = await Movie.create({
            ...req.valid.body,
            source: { provider: 'manual', external_id: crypto.randomUUID() },
            created_by: req.auth.sub,
        })
        return res.status(201).json({ operation: 'insertOne', data: movie })
    } catch (error) {
        return next(error)
    }
}

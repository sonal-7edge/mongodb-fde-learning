/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { toSetPaths } = require('../shared/update')
const { buildMovieFilter } = require('../utils/helpers')

/**
 * Update Movies | Movie Store
 * @description -- Applies the same change to EVERY movie matching a filter (Model.updateMany)
 * @route       -- PATCH /api/movies   body: { filter: {...}, set: {...} }
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} result: { matchedCount, modifiedCount }
 */
module.exports.updateMovies = async (req, res, next) => {
    try {
        const filter = buildMovieFilter(req.valid.body.filter)
        const update = { $set: { ...toSetPaths(req.valid.body.set), updated_by: req.auth.sub } }
        const result = await Movie.updateMany(filter, update, { runValidators: true })
        return res.status(200).json({ operation: 'updateMany', filter, update, result })
    } catch (error) {
        return next(error)
    }
}

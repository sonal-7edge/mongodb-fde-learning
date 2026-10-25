/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')

/**
 * Delete Movie | Movie Store
 * @description -- SOFT delete: marks ONE movie deleted: true (Model.updateOne). The document stays in the collection.
 * @route       -- DELETE /api/movies/:id
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} result: { matchedCount, modifiedCount }
 */
module.exports.deleteMovie = async (req, res, next) => {
    try {
        const result = await Movie.updateOne(
            { _id: req.valid.params.id, deleted: false },
            { $set: { deleted: true, updated_by: req.auth.sub } },
        )
        if (result.matchedCount === 0) throw new HttpError(404, 'Movie not found')
        return res.status(200).json({ operation: 'updateOne (soft delete)', result })
    } catch (error) {
        return next(error)
    }
}

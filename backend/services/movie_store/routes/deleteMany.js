/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * Purge Movies | Movie Store
 * @description -- HARD delete: permanently removes every soft-deleted movie (Model.deleteMany)
 * @route       -- DELETE /api/movies
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} result: { deletedCount }
 */
module.exports.purgeMovies = async (req, res, next) => {
    try {
        const result = await Movie.deleteMany({ deleted: true })
        return res.status(200).json({ operation: 'deleteMany', filter: { deleted: true }, result })
    } catch (error) {
        return next(error)
    }
}

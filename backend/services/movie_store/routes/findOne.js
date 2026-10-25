/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')
const { runWithOptionalExplain } = require('../shared/explain')

/**
 * Get Movie | Movie Store
 * @description -- Reads ONE movie by id (Model.findOne)
 * @route       -- GET /api/movies/:id?explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: the movie, plan: with ?explain=true
 */
module.exports.findMovie = async (req, res, next) => {
    try {
        const query = Movie.findOne({ _id: req.valid.params.id, deleted: false }).lean()
        const { data, plan } = await runWithOptionalExplain(query, req.valid.query.explain)
        if (!data) throw new HttpError(404, 'Movie not found')
        return res.status(200).json({ operation: 'findOne', data, plan })
    } catch (error) {
        return next(error)
    }
}

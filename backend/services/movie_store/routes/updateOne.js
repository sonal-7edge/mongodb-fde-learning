/**
 * @import : External Dependencies
 */
const mongoose = require('mongoose')

/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')
const { toSetPaths } = require('../shared/update')

/**
 * Update Movie | Movie Store
 * @description -- Changes whitelisted fields of ONE movie (Model.updateOne). Returns MongoDB's counts, not the movie.
 * @route       -- PATCH /api/movies/:id
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} result: { matchedCount, modifiedCount } — modifiedCount is 0 if nothing actually changed
 */
module.exports.updateMovie = async (req, res, next) => {
    try {
        const _id = new mongoose.Types.ObjectId(decodeURIComponent(req.valid.params.id))
        const update = { $set: { ...toSetPaths(req.valid.body), updated_by: req.auth.sub } }
        // runValidators: schema rules (enum, min/max) are NOT checked on updates unless you ask
        const result = await Movie.updateOne({ _id, deleted: false }, update, { runValidators: true })
        // An update that matches nothing is not an error in MongoDB; we turn it into a 404
        if (result.matchedCount === 0) throw new HttpError(404, 'Movie not found')
        return res.status(200).json({ operation: 'updateOne', update, result })
    } catch (error) {
        return next(error)
    }
}

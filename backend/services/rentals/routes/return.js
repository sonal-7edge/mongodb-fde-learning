/**
 * @import : External Dependencies
 */
const mongoose = require('mongoose')

/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')
const Rental = require('../entities/Rental')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')

/**
 * Return a Movie | Rentals
 * @description -- Closes an active rental and puts the copy back, inside ONE transaction:
 *                 1. mark the rental returned and add a 'returned' event (only if it is still active)
 *                 2. $inc the movie's inventory.available +1
 *                 Both happen, or neither does.
 * @route       -- POST /api/rentals/:id/return
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: the rental after the return
 * @apiError    -- (404) Rental not found, (409) Already returned
 */
module.exports.returnRental = async (req, res, next) => {
    const { id } = req.valid.params
    const session = await mongoose.startSession()
    try {
        let rental
        await session.withTransaction(async () => {
            const now = new Date()
            rental = await Rental.findOneAndUpdate(
                { _id: id, status: { $ne: 'returned' }, deleted: false },
                {
                    $set: { status: 'returned', returned_at: now, updated_by: req.auth.sub },
                    $push: { events: { type: 'returned', at: now } },
                },
                { returnDocument: 'after', runValidators: true, session, lean: true },
            )
            if (!rental) {
                const exists = await Rental.exists({ _id: id, deleted: false }).session(session)
                throw exists ? new HttpError(409, 'Already returned') : new HttpError(404, 'Rental not found')
            }
            await Movie.updateOne({ _id: rental.movie._id }, { $inc: { 'inventory.available': 1 } }, { session })
        })
        return res.status(200).json({ operation: 'transaction: findOneAndUpdate + updateOne', data: rental })
    } catch (error) {
        return next(error)
    } finally {
        await session.endSession()
    }
}

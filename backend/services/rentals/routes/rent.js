/**
 * @import : External Dependencies
 */
const mongoose = require('mongoose')

/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')
const Employee = require('../entities/Employee')
const Rental = require('../entities/Rental')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')
const { newRentalCode, computePricing, addDays } = require('../utils/helpers')

/**
 * Rent a Movie | Rentals
 * @description -- A person rents a movie, served by an employee who must exist. Inside ONE transaction:
 *                 1. read the employee (not found → 404, nothing is changed)
 *                 2. take one copy: $inc inventory.available -1, with "available > 0" in the filter (none left → 409)
 *                 3. insert the rental with snapshots of the movie and the employee
 *                 If any step fails, MongoDB rolls back all of them: no lost copies, no half-made rentals.
 * @route       -- POST /api/rentals   body: { movie_id, employee_id, customer: { name, email, phone? }, days? }
 * @access      -- (Bearer token)
 * @apiSuccess  -- (201) {Object} data: the rental
 * @apiError    -- (404) Employee not found / Movie not found, (409) Out of stock / no rental price
 */
module.exports.rentMovie = async (req, res, next) => {
    const { movie_id, employee_id, customer, days } = req.valid.body
    const session = await mongoose.startSession()
    try {
        let rental
        // withTransaction commits at the end, aborts on any error, and retries on write conflicts
        await session.withTransaction(async () => {
            // 1. The employee serving the customer must exist
            const employee = await Employee.findOne(
                { _id: employee_id, deleted: false },
                { first_name: 1, last_name: 1, employee_code: 1 },
            ).session(session).lean()
            if (!employee) throw new HttpError(404, 'Employee not found')

            // 2. Take one copy. The stock check is in the filter, so this is atomic
            const movie = await Movie.findOneAndUpdate(
                { _id: movie_id, deleted: false, 'inventory.available': { $gt: 0 } },
                { $inc: { 'inventory.available': -1, 'stats.rental_count': 1 } },
                { returnDocument: 'after', session, lean: true },
            )
            if (!movie) {
                const exists = await Movie.exists({ _id: movie_id, deleted: false }).session(session)
                throw exists ? new HttpError(409, 'Out of stock') : new HttpError(404, 'Movie not found')
            }
            if (movie.price?.rent == null) throw new HttpError(409, 'This movie has no rental price')

            // 3. The rental keeps a snapshot of the movie and employee (extended reference)
            const now = new Date()
            const [created] = await Rental.create([{
                rental_code: newRentalCode(),
                status: 'active',
                movie: { _id: movie._id, title: movie.title, kind: movie.kind, year: movie.year },
                employee: {
                    _id: employee._id,
                    name: `${employee.first_name} ${employee.last_name}`,
                    employee_code: employee.employee_code,
                },
                customer,
                pricing: computePricing(movie.price.rent, days, movie.price.currency ?? 'USD'),
                events: [{ type: 'rented', at: now, by_employee_id: employee._id }],
                rented_at: now,
                due_at: addDays(now, days),
                created_by: req.auth.sub,
            }], { session })
            rental = created
        })
        return res.status(201).json({ operation: 'transaction: findOne + findOneAndUpdate + insertOne', data: rental })
    } catch (error) {
        return next(error)
    } finally {
        await session.endSession()
    }
}

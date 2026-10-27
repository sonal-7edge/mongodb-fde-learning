/**
 * @import : External Dependencies
 */
const Joi = require('joi')

/**
 * @import : Common Helpers
 */
const { MAX_LIMIT, DEFAULT_LIMIT } = require('../shared/pagination')

const objectId = Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a 24-character MongoDB ObjectId',
    'string.length': '{{#label}} must be a 24-character MongoDB ObjectId',
})

/** GET /api/rentals/:id, POST /api/rentals/:id/return */
const idParams = Joi.object({ id: objectId.required() })

/** POST /api/rentals — a person rents a movie, served by an employee who must exist */
const rentMovieBody = Joi.object({
    movie_id: objectId.required(),
    employee_id: objectId.required(),
    customer: Joi.object({
        name: Joi.string().trim().min(1).max(200).required(),
        email: Joi.string().trim().lowercase().email().required(),
        phone: Joi.string().trim().max(40).allow(null),
    }).required(),
    days: Joi.number().integer().min(1).max(30).default(3),
})

/** GET /api/rentals */
const listRentalsQuery = Joi.object({
    status: Joi.string().valid('active', 'returned', 'overdue'),
    customer_email: Joi.string().trim().lowercase().email(),
    employee_id: objectId,
    movie_id: objectId,
    // Movie title (from the snapshot) starts with this text (case-sensitive)
    movie_title: Joi.string().trim().min(1).max(200),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    explain: Joi.boolean().default(false),
})

/** GET /api/rentals/:id */
const getRentalQuery = Joi.object({ explain: Joi.boolean().default(false) })

module.exports = { idParams, rentMovieBody, listRentalsQuery, getRentalQuery }

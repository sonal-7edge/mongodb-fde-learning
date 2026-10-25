/**
 * @import : External Dependencies
 */
const Joi = require('joi')

/**
 * @import : Common Helpers
 */
const { MAX_LIMIT, DEFAULT_LIMIT } = require('../shared/pagination')

const SEED_MAX = Number(process.env.SEED_MAX ?? 100000)

// Reusable pieces
const objectId = Joi.string().hex().length(24)
const explain = Joi.boolean().default(false)
const genre = Joi.string().trim().lowercase().max(40)

/** GET/PATCH/DELETE /api/movies/:id */
const idParams = Joi.object({
    id: objectId.required().messages({
        'string.hex': '"id" must be a 24-character MongoDB ObjectId',
        'string.length': '"id" must be a 24-character MongoDB ObjectId',
    }),
})

/** Fields a client may send when creating a movie. */
const movieFields = {
    title: Joi.string().trim().min(1).max(200),
    kind: Joi.string().valid('movie', 'series'),
    genres: Joi.array().items(genre).max(10),
    year: Joi.number().integer().min(1870).max(2100).allow(null),
    released_at: Joi.date().iso().allow(null),
    runtime_min: Joi.number().integer().min(1).max(1000).allow(null),
    rating: Joi.number().min(0).max(10).allow(null),
    age_rating: Joi.string().trim().max(20).allow(null),
    summary: Joi.string().allow('').max(5000),
    language: Joi.string().trim().max(40).allow(null),
    country: Joi.string().trim().uppercase().length(2).allow(null),
    director: Joi.string().trim().max(200).allow(null),
    poster_url: Joi.string().uri().allow(null),
    price: Joi.object({
        rent: Joi.number().min(0).allow(null),
        buy: Joi.number().min(0).allow(null),
        currency: Joi.string().uppercase().length(3).allow(null),
    }),
    external_ids: Joi.object({
        imdb: Joi.string().pattern(/^tt\d+$/).allow(null),
    }),
}

/** POST /api/movies */
const createMovieBody = Joi.object({
    ...movieFields,
    title: movieFields.title.required(),
    kind: movieFields.kind.required(),
    inventory: Joi.object({
        total: Joi.number().integer().min(0).max(1000).required(),
        // available can never be more than total
        available: Joi.number().integer().min(0).max(Joi.ref('total')).required(),
    }),
})

/** POST /api/movies/bulk */
const insertMoviesBody = Joi.object({
    movies: Joi.array().items(createMovieBody).min(1).max(100).required(),
})

/**
 * Filters shared by find, count and updateMany. Every key maps to one condition in buildMovieFilter().
 */
const movieFilterFields = {
    genre,
    kind: Joi.string().valid('movie', 'series'),
    year_from: Joi.number().integer().min(1870).max(2100),
    year_to: Joi.number().integer().min(1870).max(2100),
    min_rating: Joi.number().min(0).max(10),
    in_stock: Joi.boolean(),
}

/** GET /api/movies */
const findMoviesQuery = Joi.object({
    ...movieFilterFields,
    sort: Joi.string().valid('rating', 'year').default('rating'),
    limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    cursor: Joi.string().max(500),
    explain,
})

/** GET /api/movies/count */
const countMoviesQuery = Joi.object(movieFilterFields)

/** GET /api/movies/:id */
const findMovieQuery = Joi.object({ explain })

/**
 * PATCH /api/movies/:id — whitelisted fields only.
 * inventory, stats and source are NOT here: stock changes go through POST /:id/stock (atomic $inc).
 */
const updateMovieBody = Joi.object(movieFields).min(1)

/** PATCH /api/movies — updateMany: which movies (filter) and what to set (set). */
const updateMoviesBody = Joi.object({
    // At least one filter key, so a request can't update the whole collection by accident.
    filter: Joi.object(movieFilterFields).min(1).required(),
    set: Joi.object({
        genres: movieFields.genres,
        age_rating: movieFields.age_rating,
        language: movieFields.language,
        price: movieFields.price,
    }).min(1).required(),
})

/** POST /api/movies/:id/stock */
const adjustStockBody = Joi.object({
    action: Joi.string().valid('take', 'return').required(),
})

/** POST /api/movies/admin/seed */
const seedMoviesBody = Joi.object({
    count: Joi.number().integer().min(1).max(SEED_MAX).required(),
    batch_size: Joi.number().integer().min(1).max(10000).default(1000),
    seed: Joi.number().integer().default(42),
})

module.exports = {
    idParams,
    createMovieBody,
    insertMoviesBody,
    findMoviesQuery,
    countMoviesQuery,
    findMovieQuery,
    updateMovieBody,
    updateMoviesBody,
    adjustStockBody,
    seedMoviesBody,
}

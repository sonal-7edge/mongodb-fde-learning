// SOURCE OF TRUTH: /entities/Movie.js. Do not edit copies under services/*/entities — run "make sync".
const { randomUUID } = require('node:crypto')
const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')

const { Schema } = mongoose

/**
 * A movie or series in the catalogue. Field names are OUR domain names:
 * external API keys never appear here (they stay inside services/movie_store/sources/).
 *
 * @typedef {Object} Movie
 * @property {string} title
 * @property {'movie'|'series'} kind
 * @property {string[]} genres                lowercase, e.g. ['drama', 'comedy']
 * @property {number|null} year
 * @property {Date|null} released_at
 * @property {number|null} runtime_min
 * @property {number|null} rating            normalised to 0–10
 * @property {string|null} age_rating
 * @property {string} summary                 plain text, HTML stripped
 * @property {string|null} language
 * @property {string|null} country           ISO-2 when known
 * @property {string|null} director
 * @property {string|null} poster_url
 * @property {{rent: number|null, buy: number|null, currency: string|null}} price
 * @property {{total: number, available: number}} inventory   embedded counters, changed with atomic $inc
 * @property {{rental_count: number}} stats                   computed pattern: updated on each rental
 * @property {{provider: 'tvmaze'|'itunes'|'manual', external_id: string, fetched_at: Date}} source
 * @property {{imdb: string|null}} external_ids
 */
const MovieSchema = new Schema({
    // Basic Details
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['movie', 'series'], required: true },
    genres: { type: [String], default: [] },
    year: { type: Number, default: null },
    released_at: { type: Date, default: null },
    runtime_min: { type: Number, default: null },
    rating: { type: Number, min: 0, max: 10, default: null },
    age_rating: { type: String, default: null },
    summary: { type: String, default: '' },
    language: { type: String, default: null },
    country: { type: String, default: null },
    director: { type: String, default: null },
    poster_url: { type: String, default: null },

    // Price Details
    price: {
        rent: { type: Number, default: null },
        buy: { type: Number, default: null },
        currency: { type: String, default: null },
    },

    // Stock Details (embedded counters, changed with atomic $inc)
    inventory: {
        total: { type: Number, min: 0, default: 3 },
        available: { type: Number, min: 0, default: 3 },
    },
    // Computed pattern: kept up to date on each rental instead of counting rentals on every read
    stats: {
        rental_count: { type: Number, min: 0, default: 0 },
    },

    // Source Details (where the record was imported from)
    source: {
        provider: { type: String, enum: ['tvmaze', 'itunes', 'manual'], required: true },
        external_id: { type: String, required: true },
        fetched_at: { type: Date, default: Date.now },
    },
    external_ids: {
        imdb: { type: String, default: null },
    },

    // Audit Details
    created_by: { type: String, default: '' },
    created_by_email: { type: String, default: '' },
    updated_by: { type: String, default: '' },
    updated_by_email: { type: String, default: '' },
    // A function, so every document gets its own id (a plain randomUUID() would run once, at load time)
    update_id: { type: String, default: () => randomUUID() },

    // Soft delete: the document stays, queries must filter { deleted: false }
    deleted: { type: Boolean, default: false },
}, {
    // Mongoose sets created_at once and updated_at on every save/update
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

MovieSchema.plugin(mongoosePaginate)

const Movie = mongoose.model(`${process.env.STAGE}-movies`, MovieSchema)

module.exports = Movie

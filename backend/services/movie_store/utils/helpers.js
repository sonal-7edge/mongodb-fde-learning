/**
 * @import : External Dependencies
 */
const { faker } = require('@faker-js/faker')

const GENRES = ['drama', 'comedy', 'action', 'thriller', 'romance', 'horror', 'sci-fi', 'animation', 'crime', 'family', 'documentary', 'fantasy']
const LANGUAGES = ['en', 'hi', 'fr', 'es', 'ja', 'ko', 'de', 'it']
const COUNTRIES = ['US', 'IN', 'GB', 'FR', 'ES', 'JP', 'KR', 'DE', 'IT', 'CA']
const AGE_RATINGS = ['G', 'PG', 'PG-13', 'R']

/**
 * Builds a MongoDB filter from validated query/filter fields. Soft-deleted movies are always excluded.
 *
 * @param {{genre?: string, kind?: string, year_from?: number, year_to?: number, min_rating?: number, in_stock?: boolean}} fields
 * @returns {object}
 */
function buildMovieFilter(fields = {}) {
    const filter = { deleted: false }
    // genres is an array: { genres: 'drama' } matches any movie whose array CONTAINS 'drama'
    if (fields.genre) filter.genres = fields.genre
    if (fields.kind) filter.kind = fields.kind
    if (fields.year_from !== undefined || fields.year_to !== undefined) {
        filter.year = {}
        if (fields.year_from !== undefined) filter.year.$gte = fields.year_from
        if (fields.year_to !== undefined) filter.year.$lte = fields.year_to
    }
    if (fields.min_rating !== undefined) filter.rating = { $gte: fields.min_rating }
    if (fields.in_stock === true) filter['inventory.available'] = { $gt: 0 }
    if (fields.in_stock === false) filter['inventory.available'] = 0
    return filter
}

/**
 * One synthetic movie in our domain shape. Call faker.seed() first for repeatable output.
 * @param {string} createdBy
 * @returns {object}
 */
function fakeMovie(createdBy) {
    const kind = faker.helpers.weightedArrayElement([{ weight: 7, value: 'movie' }, { weight: 3, value: 'series' }])
    const year = faker.number.int({ min: 1970, max: 2025 })
    const copies = faker.number.int({ min: 1, max: 5 })
    const title = `${faker.word.adjective()} ${faker.word.noun()}`.replace(/\b\w/g, (c) => c.toUpperCase())
    return {
        title,
        kind,
        genres: faker.helpers.arrayElements(GENRES, { min: 1, max: 3 }),
        year,
        released_at: faker.date.between({ from: `${year}-01-01`, to: `${year}-12-31` }),
        runtime_min: kind === 'movie' ? faker.number.int({ min: 80, max: 180 }) : faker.number.int({ min: 20, max: 60 }),
        rating: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
        age_rating: faker.helpers.arrayElement(AGE_RATINGS),
        summary: faker.lorem.sentences(2),
        language: faker.helpers.arrayElement(LANGUAGES),
        country: faker.helpers.arrayElement(COUNTRIES),
        director: faker.person.fullName(),
        poster_url: null,
        price: {
            rent: faker.number.float({ min: 1.99, max: 4.99, fractionDigits: 2 }),
            buy: faker.number.float({ min: 7.99, max: 19.99, fractionDigits: 2 }),
            currency: 'USD',
        },
        inventory: { total: copies, available: copies },
        source: { provider: 'manual', external_id: faker.string.uuid() },
        created_by: createdBy,
    }
}

module.exports = { buildMovieFilter, fakeMovie }

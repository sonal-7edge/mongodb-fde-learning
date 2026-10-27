/**
 * Indexes the demo can switch on and off. The app never creates them at startup:
 * each one is added on purpose, through POST /api/movies/admin/indexes/:name, for one access pattern.
 *
 * @type {Object<string, {key: object, name: string, access_pattern: string}>}
 */
const MOVIE_INDEXES = {
    title: {
        key: { title: 1 },
        name: 'title_1',
        access_pattern: 'Find a movie by the start of its title (GET /api/movies/by-title?title=)',
    },
}

module.exports = { MOVIE_INDEXES }

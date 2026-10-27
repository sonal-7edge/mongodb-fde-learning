const mongoose = require('mongoose')

// Each service requires its own synced copy of the entities, so the same model name is registered
// more than once in this process. Allow that (otherwise Mongoose throws OverwriteModelError).
// Must run before any entity file is required below.
mongoose.set('overwriteModels', true)

const express = require('express')

/**
 * @import : Common Helpers
 * app.js requires shared code through a service's synced copy, never the root shared/
 * (the Docker image does not contain the root entities/ and shared/ folders).
 */
const { loadAuthConfig, requireAuth } = require('./services/platform/shared/auth.js')
const { errorHandler, notFound } = require('./services/platform/shared/errors.js')
const { serverTiming } = require('./services/platform/shared/timing.js')
const { validate } = require('./services/platform/shared/validate.js')
const { buildPlatformRouters } = require('./services/platform/routes/index.js')

/**
 * @import : Joi schemas
 */
const employeeSchema = require('./services/employee_management/utils/joi_schema.js')
const movieSchema = require('./services/movie_store/utils/joi_schema.js')
const rentalSchema = require('./services/rentals/utils/joi_schema.js')

/**
 * @import : Route handlers | Employee Management (each does ONE operation on ONE record)
 */
const { seedEmployees } = require('./services/employee_management/routes/seed.js')
const { createEmployee } = require('./services/employee_management/routes/create.js')
const { listEmployees } = require('./services/employee_management/routes/list.js')
const { getEmployee } = require('./services/employee_management/routes/get.js')
const { updateEmployee } = require('./services/employee_management/routes/update.js')
const { deleteEmployee } = require('./services/employee_management/routes/delete.js')

/**
 * @import : Route handlers | Movie Store (one file per MongoDB operation)
 */
const { seedMovies } = require('./services/movie_store/routes/seed.js')
const { createMovie } = require('./services/movie_store/routes/insertOne.js')
const { insertMovies } = require('./services/movie_store/routes/insertMany.js')
const { findMovies } = require('./services/movie_store/routes/find.js')
const { findMovie } = require('./services/movie_store/routes/findOne.js')
const { countMovies } = require('./services/movie_store/routes/countDocuments.js')
const { distinctGenres } = require('./services/movie_store/routes/distinct.js')
const { updateMovie } = require('./services/movie_store/routes/updateOne.js')
const { updateMovies } = require('./services/movie_store/routes/updateMany.js')
const { adjustStock } = require('./services/movie_store/routes/findOneAndUpdate.js')
const { deleteMovie } = require('./services/movie_store/routes/softDelete.js')
const { purgeMovies } = require('./services/movie_store/routes/deleteMany.js')
const { findMoviesByTitle } = require('./services/movie_store/routes/findByTitle.js')
const { listIndexes } = require('./services/movie_store/routes/listIndexes.js')
const { createIndex } = require('./services/movie_store/routes/createIndex.js')
const { dropIndex } = require('./services/movie_store/routes/dropIndex.js')

/**
 * @import : Route handlers | Rentals (rent and return each run inside one transaction)
 */
const { rentMovie } = require('./services/rentals/routes/rent.js')
const { returnRental } = require('./services/rentals/routes/return.js')
const { listRentals } = require('./services/rentals/routes/list.js')
const { getRental } = require('./services/rentals/routes/get.js')

// Query-operator injection (`?genre[$ne]=x`) is blocked twice, without mongoose's sanitizeFilter
// (which would also reject the $gte/$in operators our own code builds):
//   1. Express 5 parses query strings 'simple': `genre[$ne]` stays a plain key, never an object.
//   2. Every route validates input with a Joi schema that rejects unknown keys and wrong types.

/**
 * Builds the Express app without listening, so tests can use it with supertest.
 * @param {{authConfig?: ReturnType<typeof loadAuthConfig>}} [options]
 * @returns {import('express').Express}
 */
function buildApp(options = {}) {
    const authConfig = options.authConfig ?? loadAuthConfig(process.env)
    const { publicRouters, adminRouter } = buildPlatformRouters(authConfig)

    // Every /api endpoint below starts with `auth`: it needs 'Authorization: Bearer <token>'.
    const auth = requireAuth(authConfig)

    const app = express()
    app.disable('x-powered-by')
    app.use(serverTiming)
    app.use(express.json({ limit: '10mb' }))

    // Public: /health and (if enabled) POST /auth/token
    app.use(publicRouters)
    app.use('/api/admin', auth, adminRouter)

    // ---------- Employee Management ----------
    app.post('/api/employees/admin/seed', auth, validate({ body: employeeSchema.seedEmployeesBody }), seedEmployees)
    app.post('/api/employees', auth, validate({ body: employeeSchema.createEmployeeBody }), createEmployee)
    app.get('/api/employees', auth, validate({ query: employeeSchema.listEmployeesQuery }), listEmployees)
    app.get('/api/employees/:id', auth, validate({ params: employeeSchema.idParams, query: employeeSchema.getEmployeeQuery }), getEmployee)
    app.patch('/api/employees/:id', auth, validate({ params: employeeSchema.idParams, body: employeeSchema.updateEmployeeBody }), updateEmployee)
    app.delete('/api/employees/:id', auth, validate({ params: employeeSchema.idParams }), deleteEmployee)

    // ---------- Movie Store ----------
    // ORDER MATTERS: Express tries routes top to bottom, so fixed paths ('/count', '/genres')
    // come before '/:id', otherwise '/count' would be read as an id.
    app.post('/api/movies/admin/seed', auth, validate({ body: movieSchema.seedMoviesBody }), seedMovies)            // insertMany (batched)
    app.get('/api/movies/admin/indexes', auth, listIndexes)                                                        // listIndexes
    app.post('/api/movies/admin/indexes/:name', auth, validate({ params: movieSchema.indexNameParams }), createIndex)  // createIndex
    app.delete('/api/movies/admin/indexes/:name', auth, validate({ params: movieSchema.indexNameParams }), dropIndex)  // dropIndex
    app.post('/api/movies', auth, validate({ body: movieSchema.createMovieBody }), createMovie)                    // insertOne
    app.post('/api/movies/bulk', auth, validate({ body: movieSchema.insertMoviesBody }), insertMovies)             // insertMany
    app.get('/api/movies', auth, validate({ query: movieSchema.findMoviesQuery }), findMovies)                    // find
    app.get('/api/movies/by-title', auth, validate({ query: movieSchema.findMoviesByTitleQuery }), findMoviesByTitle)   // find (title prefix)
    app.get('/api/movies/count', auth, validate({ query: movieSchema.countMoviesQuery }), countMovies)             // countDocuments
    app.get('/api/movies/genres', auth, validate({ query: movieSchema.distinctGenresQuery }), distinctGenres)   // distinct
    app.patch('/api/movies', auth, validate({ body: movieSchema.updateMoviesBody }), updateMovies)                // updateMany
    app.delete('/api/movies', auth, purgeMovies)                                                                 // deleteMany
    app.get('/api/movies/:id', auth, validate({ params: movieSchema.idParams, query: movieSchema.findMovieQuery }), findMovie)          // findOne
    app.patch('/api/movies/:id', auth, validate({ params: movieSchema.idParams, body: movieSchema.updateMovieBody }), updateMovie)     // updateOne
    app.post('/api/movies/:id/stock', auth, validate({ params: movieSchema.idParams, body: movieSchema.adjustStockBody }), adjustStock) // findOneAndUpdate
    app.delete('/api/movies/:id', auth, validate({ params: movieSchema.idParams }), deleteMovie)                                      // updateOne (soft delete)

    // ---------- Rentals ----------
    app.post('/api/rentals', auth, validate({ body: rentalSchema.rentMovieBody }), rentMovie)                                       // transaction
    app.get('/api/rentals', auth, validate({ query: rentalSchema.listRentalsQuery }), listRentals)
    app.get('/api/rentals/:id', auth, validate({ params: rentalSchema.idParams, query: rentalSchema.getRentalQuery }), getRental)
    app.post('/api/rentals/:id/return', auth, validate({ params: rentalSchema.idParams }), returnRental)                           // transaction

    app.use(notFound)
    app.use(errorHandler)
    return app
}

module.exports = { buildApp }

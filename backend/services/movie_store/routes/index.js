const { Router } = require('express')

// Mounted at /api/movies. Routes are added stage by stage (see README branch table).
const movieStoreRouter = Router()

module.exports = { movieStoreRouter }

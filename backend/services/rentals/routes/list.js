/**
 * @import : Entities
 */
const Rental = require('../entities/Rental')

/**
 * @import : Common Helpers
 */
const { summarizeExplain } = require('../shared/explain')
const { prefixMatch } = require('../shared/search')

// mongoose-paginate-v2 returns camelCase keys; rename them to our snake_case style
const PAGE_LABELS = {
    docs: 'data',
    totalDocs: 'total_docs',
    totalPages: 'total_pages',
    hasPrevPage: 'has_prev_page',
    hasNextPage: 'has_next_page',
    prevPage: 'prev_page',
    nextPage: 'next_page',
    pagingCounter: 'paging_counter',
    meta: null,
}

/**
 * List Rentals | Rentals
 * @description -- One page of rentals, newest first, filtered by status / customer / employee / movie
 *                 (by its _id or the start of its title). With ?explain=true, plan is the plan of the
 *                 page query (find + sort + skip + limit); paginate also runs a countDocuments for total_docs.
 * @route       -- GET /api/rentals?status=&customer_email=&employee_id=&movie_id=&movie_title=&page=&limit=&explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data, total_docs, page, total_pages, ..., plan: with ?explain=true
 */
module.exports.listRentals = async (req, res, next) => {
    try {
        const { status, customer_email, employee_id, movie_id, movie_title, page, limit, explain } = req.valid.query
        const filter = { deleted: false }
        if (status) filter.status = status
        if (customer_email) filter['customer.email'] = customer_email
        // Filtering on the _id inside the snapshot: no join needed
        if (employee_id) filter['employee._id'] = employee_id
        if (movie_id) filter['movie._id'] = movie_id
        if (movie_title) filter['movie.title'] = prefixMatch(movie_title)

        const sort = { rented_at: -1, _id: -1 }
        const result = await Rental.paginate(filter, {
            page,
            limit,
            sort,
            lean: true,
            customLabels: PAGE_LABELS,
        })
        if (explain) {
            // The same page query paginate() ran, explained on its own
            const pageQuery = Rental.find(filter).sort(sort).skip((page - 1) * limit).limit(limit)
            result.plan = summarizeExplain(await pageQuery.explain('executionStats'))
        }
        return res.status(200).json(result)
    } catch (error) {
        return next(error)
    }
}

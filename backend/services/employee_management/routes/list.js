/**
 * @import : Entities
 */
const Employee = require('../entities/Employee')

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
 * List Employees | Employee Management
 * @description -- One page of employees, newest joiners first (mongoose-paginate-v2: countDocuments + find with skip)
 * @route       -- GET /api/employees?department=&country=&page=&limit=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data, total_docs, page, total_pages, ...
 */
module.exports.listEmployees = async (req, res, next) => {
    try {
        const { department, country, page, limit } = req.valid.query
        const filter = { deleted: false }
        if (department) filter.department = department
        if (country) filter['location.country'] = country

        const result = await Employee.paginate(filter, {
            page,
            limit,
            sort: { joined_at: -1, _id: -1 },
            lean: true,
            customLabels: PAGE_LABELS,
        })
        return res.status(200).json(result)
    } catch (error) {
        return next(error)
    }
}

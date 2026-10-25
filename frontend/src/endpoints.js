/**
 * Every endpoint the console can call. Each backend stage adds its endpoints here.
 * ":id" in a path is filled in with the last _id the console saw for that resource.
 *
 * @typedef {Object} Endpoint
 * @property {string} group          heading in the side list
 * @property {string} name
 * @property {"GET"|"POST"|"PATCH"|"DELETE"} method
 * @property {string} path           may include a query string
 * @property {boolean} [public]      true = no token needed
 * @property {boolean} [explain]     true = supports ?explain=true
 * @property {object} [body]         default JSON body
 * @property {string} [note]         one line shown under the request
 */

/** @type {Endpoint[]} */
export const endpoints = [
  // ---------- Platform ----------
  {
    group: "Platform",
    name: "Health",
    method: "GET",
    path: "/health",
    public: true,
    note: "No token needed. 200 only when MongoDB is connected.",
  },
  {
    group: "Platform",
    name: "Storage overview",
    method: "GET",
    path: "/api/admin/overview",
    note: "Size of every collection (data + indexes) against the Atlas Free tier's 0.5 GB.",
  },

  // ---------- Employees ----------
  {
    group: "Employees",
    name: "Seed employees",
    method: "POST",
    path: "/api/employees/admin/seed",
    body: { count: 500, batch_size: 500, seed: 42 },
    note: "insertMany in batches of synthetic employees.",
  },
  {
    group: "Employees",
    name: "Create",
    method: "POST",
    path: "/api/employees",
    body: {
      first_name: "Asha",
      last_name: "Rao",
      email: "asha.rao@example.com",
      department: "Sales",
      job_title: "Store Associate",
      location: { city: "Pune", country: "India" },
      skills: ["customer service", "inventory"],
    },
    note: "Model.create. The server generates employee_code.",
  },
  {
    group: "Employees",
    name: "List (paginated)",
    method: "GET",
    path: "/api/employees?page=1&limit=20",
    note: "mongoose-paginate-v2 (count + find with skip). Filters: department, country.",
  },
  {
    group: "Employees",
    name: "Get by id",
    method: "GET",
    path: "/api/employees/:id",
    explain: true,
    note: "Model.findOne by _id.",
  },
  {
    group: "Employees",
    name: "Update",
    method: "PATCH",
    path: "/api/employees/:id",
    body: { job_title: "Store Manager", location: { city: "Mumbai" } },
    note: "Model.findOneAndUpdate, returns the employee after the change. location.country is kept.",
  },
  {
    group: "Employees",
    name: "Delete (soft)",
    method: "DELETE",
    path: "/api/employees/:id",
    note: "Sets deleted:true.",
  },
  // ---------- Movies: seed ----------
  {
    group: "Movies: seed",
    name: "Seed movies",
    method: "POST",
    path: "/api/movies/admin/seed",
    body: { count: 1000, batch_size: 1000, seed: 42 },
    note: "insertMany in batches of synthetic movies. Same seed = same movies. Refuses (507) past 80% of 0.5 GB.",
  },

  // ---------- Movies: read ----------
  {
    group: "Movies: read",
    name: "find (list)",
    method: "GET",
    path: "/api/movies?genre=drama&sort=rating&limit=20",
    explain: true,
    note: "Model.find. Filters: genre, kind, year_from, year_to, min_rating, in_stock. Next page: add &cursor=<next_cursor>.",
  },
  {
    group: "Movies: read",
    name: "findOne (by id)",
    method: "GET",
    path: "/api/movies/:id",
    explain: true,
    note: "Model.findOne by _id. Every collection has an _id index, so this never scans.",
  },
  {
    group: "Movies: read",
    name: "countDocuments",
    method: "GET",
    path: "/api/movies/count?kind=movie&in_stock=true",
    note: "Counts matching movies without returning them.",
  },
  {
    group: "Movies: read",
    name: "distinct genres",
    method: "GET",
    path: "/api/movies/genres",
    note: "Model.distinct on an array field: every element counts once.",
  },

  // ---------- Movies: write ----------
  {
    group: "Movies: write",
    name: "insertOne (create)",
    method: "POST",
    path: "/api/movies",
    body: {
      title: "Space Adventure",
      kind: "movie",
      genres: ["sci-fi", "drama"],
      year: 2001,
      rating: 8.1,
      summary: "A crew travels to the edge of the solar system.",
      price: { rent: 2.99, buy: 9.99, currency: "USD" },
      inventory: { total: 1, available: 1 },
    },
    note: "Model.create. The server adds source, audit fields, deleted:false and timestamps.",
  },
  {
    group: "Movies: write",
    name: "insertMany (bulk)",
    method: "POST",
    path: "/api/movies/bulk",
    body: {
      movies: [
        { title: "Laugh Lines", kind: "series", genres: ["comedy"], year: 2015, rating: 6.4 },
        { title: "Night Train", kind: "movie", genres: ["thriller"], year: 1998, rating: 7.2 },
      ],
    },
    note: "One round trip for up to 100 movies.",
  },
  {
    group: "Movies: write",
    name: "updateOne (patch)",
    method: "PATCH",
    path: "/api/movies/:id",
    body: { rating: 9, price: { rent: 3.49 } },
    note: "Returns matchedCount/modifiedCount. Send it twice: modifiedCount stays 1, because updated_at changes on every update.",
  },
  {
    group: "Movies: write",
    name: "updateMany",
    method: "PATCH",
    path: "/api/movies",
    body: { filter: { genre: "drama" }, set: { price: { rent: 1.99 } } },
    note: "Same change to every matching movie. filter needs at least one key.",
  },
  {
    group: "Movies: write",
    name: "findOneAndUpdate (take a copy)",
    method: "POST",
    path: "/api/movies/:id/stock",
    body: { action: "take" },
    note: "Atomic $inc with the stock check in the filter. Take more copies than exist: 409 Out of stock.",
  },
  {
    group: "Movies: write",
    name: "soft delete (updateOne)",
    method: "DELETE",
    path: "/api/movies/:id",
    note: "Sets deleted:true. The document stays; reads stop returning it.",
  },
  {
    group: "Movies: write",
    name: "deleteMany (purge soft-deleted)",
    method: "DELETE",
    path: "/api/movies",
    note: "Permanently removes every movie with deleted:true.",
  },


  // ---------- Rentals ----------
  {
    group: "Rentals",
    name: "Rent a movie (transaction)",
    method: "POST",
    path: "/api/rentals",
    body: {
      movie_id: ":movie_id",
      employee_id: ":employee_id",
      customer: { name: "Ravi Kumar", email: "ravi@example.com", phone: "+91 98450 00000" },
      days: 3,
    },
    note: "One transaction: employee must exist → take a copy ($inc) → insert rental. Any failure rolls back all of it.",
  },
  {
    group: "Rentals",
    name: "Return (transaction)",
    method: "POST",
    path: "/api/rentals/:id/return",
    note: "One transaction: mark returned + push event → put the copy back. Returning twice: 409.",
  },
  {
    group: "Rentals",
    name: "List",
    method: "GET",
    path: "/api/rentals?status=active&page=1&limit=20",
    note: "Filters: status, customer_email, employee_id, movie_id (the _id inside the snapshot, no join).",
  },
  {
    group: "Rentals",
    name: "Get by id",
    method: "GET",
    path: "/api/rentals/:id",
    explain: true,
    note: "Movie title and employee name come from the snapshot inside the rental.",
  },
];

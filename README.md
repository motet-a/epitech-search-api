# epitech-search

An API to search EPITECH students. Powered by Node.js, Express.js and
Redis.

This is aimed for autocompletion purposes, but this is not fuzzy seach
however.



# How to

Clone the repository, install the dependencies with `npm install`,
start a Redis server listening on the default port (6379) and run
`node index.js`.

The server will fetch data about the students from
[intra.epitech.eu](intra.epitech.eu), build search indexes and store
everything into the Redis database.

Once you see 'Listening on port 3000.', you can open a browser window
to access the `/compl` endpoint (for the autocompletion) and try some
queries like
[http://localhost:3000/compl?q=Antoine+Motet](http://localhost:3000/compl?q=Antoine+Motet).



# Endpoints

### GET /user/:login

Returns user information from a given login.

Example: [http://localhost:3000/user/motet_a](http://localhost:3000/user/motet_a)


### GET /compl

Returns a list of completions for a given query. A completion is an
user object with an additionnal field, the `rank`. The highest rank is
the closest match from the query. The completions are sorted by
descending rank.

URL parameters:

  - **q** (required): The query to search for.

Example: [http://localhost:3000/compl?q=Antoine+Motet](http://localhost:3000/compl?q=Antoine+Motet)

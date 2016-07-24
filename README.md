# epitech-search

A REST API to search EPITECH students. Powered by Node.js, Express.js
and Redis.

This is not fuzzy seach however.

## How to

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

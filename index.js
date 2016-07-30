"use strict";

// `env` equals 'dev' or 'prod'
const env = require('get-env')();

const configModule = require('./config');
const config = env === 'dev' ? configModule.dev : configModule.prod;

const express = require('express');
const redis = require('redis');
const Promise = require('promise');

const {fetchUsers} = require('./intra.epitech.eu');

if (env === 'dev') {
    require('promise/lib/rejection-tracking').enable();
}



(function () {

    function get(varName) {
        return process.env['EPITECH_SEARCH_' + varName];
    }

    if (get('REDIS_HOST')) {
        config.redis.host = get('REDIS_HOST');
    }

    console.log('Config:');
    console.log(config);

})();



const app = express();

function createNotFoundError() {
    const e = new Error('not_found');
    e.status = 404;
    return e;
}

const redisClient = redis.createClient({
    host: config.redis.host,
});

redisClient.on('error', console.error);



function redisMultiToPromise(multi) {
    return new Promise((resolve, reject) => {
        multi.exec((error, replies) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(replies);
        });
    });
}

function saveUsersToRedis(users) {
    const multi = redisClient.multi();

    for (let user of users) {
        multi.set('user:' + user.login, JSON.stringify(user));
    }

    return redisMultiToPromise(multi);
}

function saveIndexToRedis(index) {
    const multi = redisClient.multi();

    for (let key of Object.keys(index)) {
        multi.hset('index', key.toString(), index[key].join(' '));
    }

    return redisMultiToPromise(multi);
}

function saveAutocompleteIndexToRedis(index) {
    const multi = redisClient.multi();

    for (let key of index) {
        multi.zadd('compl', 0, key);
    }

    return redisMultiToPromise(multi);
}



/** Returns the *big* hash map. Maps keys to lists of logins. */
function createIndex(users, locationNames) {
    const index = {};

    function add(key, login) {
        if (!(key in index)) {
            index[key] = [login];
            return;
        }

        const logins = index[key];
        if (logins.indexOf(login) !== -1)
            return;

        logins.push(login);
    }

    for (let user of users) {
        const login = user.login
        add(login, login);
        if (login.indexOf('_') !== -1) {
            const i = login.indexOf('_');
            const loginPrefix = login.substring(0, i);
            add(loginPrefix, login);
        }
        add(user.firstName, login);
        add(user.lastName, login);
        add(user.year, login);
        add(user.location, login);
        //add(locationNames[user.location], login);
    }

    return index;
}

/**
 * Returns a list of strings.
 * The strings which are keys of the given index ends with a '*'.
 */
function createAutocompleteIndex(index) {
    const autocompleteIndex = [];

    function addCompl(key) {
        if (autocompleteIndex.indexOf(key) !== -1) {
            return;
        }
        autocompleteIndex.push(key);
    }

    function add(key) {
        addCompl(key + '*');
        while (key.length >= 1) {
            addCompl(key);
            key = key.substring(0, key.length - 1);
        }
    }

    Object.keys(index).forEach(add);
    return autocompleteIndex;
}



app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});




app.get('/', (req, res) => {
    res.send('<h1>Hello World!</h1>' +
             '<a href="https://github.com/motet-a/epitech-search-api">' +
             'https://github.com/motet-a/epitech-search-api' +
             '</a>');
});



app.get('/user/:login', (req, res, next) => {
    redisClient.get('user:' + req.params.login, (err, user) => {
        if (err) {
            console.error(err);
            return;
        }

        if (!user) {
            next(createNotFoundError());
            return;
        }

        res.set('Content-Type', 'application/json');
        res.send(user);
    });
});

function getLoginsFromKey(key, callback) {
    redisClient.hget('index', key, (err, loginsString) => {
        if (err)
            return callback(err);

        if (!loginsString)
            return callback(null, []);

        callback(null, loginsString.split(' '));
    });
}

function getLoginsFromKeys(keys, callback) {
    if (keys.length === 0)
        return callback(null, []);

    const loginCounts = {};
    const processedKeys = [];

    function reduce() {
        let logins = [];

        for (let login of Object.keys(loginCounts)) {
            logins.push(login);
        }

        logins.sort((a, b) => loginCounts[b] - loginCounts[a]);

        callback(null, logins.filter((login, i) => i < 20));
    }

    for (let key of keys) {
        getLoginsFromKey(key, (err, logins) => {
            if (err)
                return callback(err);

            for (let login of logins) {
                if (loginCounts[login])
                    loginCounts[login]++;
                else
                    loginCounts[login] = 1;
            }

            processedKeys.push(key);
            if (processedKeys.length === keys.length)
                reduce();
        });
    }
}

function getUsersFromKeys(keys, callback) {
    getLoginsFromKeys(keys, (err, logins) => {
        if (err)
            return callback(err);

        if (logins.length === 0)
            return callback(null, []);

        const args = logins.map(l => 'user:' + l).concat((err, users) => {
            if (err)
                return callback(err);

            callback(null, users.map(JSON.parse));
        });

        redisClient.mget.apply(redisClient, args);
    });
}

function getCompletionIndices(query, count, callback) {
    redisClient.zrank('compl', query, (err, rank) => {
        if (err) {
            return callback(err);
        }

        if (rank === null) {
            return callback(null, []);
        }

        redisClient.zrange('compl', rank, rank + count, callback);
    });
}

/** Returns a new array */
function removeDuplicatedWords(words) {
    const counts = {};
    for (let word of words) {
        counts[word] = (counts[word] || 0) + 1;
    }
    return words.filter(word => counts[word] == 1);
}

function getCompletions(query, callback) {
    query = query.toLowerCase().trim();

    const words = removeDuplicatedWords(query.split(' '));
    if (words.length === 0)
        return callback(null, []);

    const wordObjects = {};

    function getUserRankByKey(user, key) {
        const userFields = [
            'firstName',
            'lastName',
            'login',
            'year',
            'location',
        ];

        let rank = 0;
        for (let field of userFields) {
            const value = user[field].toString().toLowerCase();
            if (value.indexOf(key) !== -1 || key.indexOf(value) !== -1)
                rank++;
        }
        return rank;
    }

    function getUserRank(user, keys) {
        let rank = 0;
        for (let key of keys) {
            rank += getUserRankByKey(user, key);
        }
        return rank;
    }

    function reduce() {
        let keys = [];
        for (let word of Object.keys(wordObjects)) {
            let wo = wordObjects[word];
            keys = keys.concat(wo.keys.filter(k => keys.indexOf(k) === -1));
        }
        const users = getUsersFromKeys(keys, (error, users) => {
            if (error)
                return callback(error);

            for (let user of users) {
                user.rank = getUserRank(user, keys);
                user.rank += getUserRank(user, words) * 10;
            }

            users.sort((a, b) => b.rank - a.rank);

            callback(null, users);
        });
    }

    for (let word of words) {
        getCompletionIndices(word, 42, (err, indices) => {
            if (err)
                return callback(err);

            const keys = indices
                  .filter(index => index.endsWith('*'))
                  .filter((index, i) => i < 10)
                  .map(key => key.substring(0, key.length - 1));

            wordObjects[word] = {word, keys};
            if (Object.keys(wordObjects).length === words.length) {
                reduce();
            }
        });
    }
}

app.get('/compl', (req, res, next) => {
    if (!req.query.q) {
        const e = new Error('bad_request');
        e.status = 400;
        next(e);
        return;
    }

    getCompletions(req.query.q, (err, completions) => {
        if (err) {
            console.error(err);
            return;
        }

        res.json(completions);
    });
});



app.use(function (req, res, next) {
    next(createNotFoundError());
});

app.use(function(err, req, res, next){
    res.status(err.status || 500);

    if (req.accepts('json')) {
        res.json({
            error: err.message,
        });
        return;
    }

    res.type('txt').send(err.message);
});

function serve() {
    const port = 3000;

    return new Promise((resolve, reject) => {
        app.listen(3000, () => {
            console.log('Listening on port ' + port + '.');
            resolve();
        });
    });
}



function flushRedisDb() {
    return new Promise((resolve, reject) => {
        redisClient.flushdb((error, result) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(result);
        });
    });
}

function assertNoDuplicatedUsers(users) {
    for (let user of users) {
        const similarUsers = users.filter(o => o.login === user.login);
        if (similarUsers.length !== 1) {
            throw new Error('Duplicated users: ' +
                            JSON.stringify(similarUsers));
        }
    }
}

function repopulateRedisDb() {
    const years = [];
    for (let y = config.firstYear; y < new Date().getFullYear() + 1; y++) {
        years.push(y);
    }

    return fetchUsers(config.locations, years, config.courses).then(users => {
        console.log(users.length + ' users fetched.');

        try {
            assertNoDuplicatedUsers(users);
        } catch (error) {
            return Promise.reject(error);
        }
        console.log('No duplicated users.');

        console.log('Creating indexes...')
        const index = createIndex(users);
        const complIndex = createAutocompleteIndex(index);

        console.log('Flushing Redis database...');
        return flushRedisDb().then(() => {
            console.log('Database flushed.');
        }).then(() => {
            console.log('Saving users to Redis...');
            return saveUsersToRedis(users).then(() => {
                console.log('Users saved to Redis.');
            });
        }).then(() => {
            console.log('Saving index to Redis...');
            return saveIndexToRedis(index).then(() => {
                console.log('Index saved to Redis.');
            });
        }).then(() => {
            console.log('Saving autocompletion index to Redis...');
            return saveAutocompleteIndexToRedis(complIndex).then(() => {
                console.log('Autocomplete index saved to Redis.');
            });
        });
    });
}


console.log('env: ' + env);

const servePromise = new Promise(function (resolve, reject) {
    repopulateRedisDb().then(() => {
        serve().then(resolve);
    }, error => {
        console.error(error);
        redisClient.quit();
        reject();
    });
});



module.exports = {
    app,
    config,
    servePromise,
};

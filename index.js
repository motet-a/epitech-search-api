"use strict";

// `env` equals 'dev' or 'prod'
const env = require('get-env')();

const configModule = require('./config');
const config = env === 'dev' ? configModule.dev : configModule.prod;

const express = require('express');
const redis = require('redis');
const httpRequest = require('request');
const Promise = require('promise');

if (env === 'dev') {
    require('promise/lib/rejection-tracking').enable();
}



const app = express();

const redisClient = redis.createClient({
    host: config.redisHost,
});

redisClient.on('error', console.error);



function convertServerUser(serverUser, year) {
    return {
        login: serverUser.login,
        firstName: serverUser.prenom,
        lastName: serverUser.nom,
        location: serverUser.location,
        year,
    }
}

function addUserToArray(users, newUser) {
    const oldUser = users.find(u => u.login === newUser.login);
    if (oldUser) {
        oldUser.year = Math.min(oldUser.year, newUser.year);
        return;
    }
    users.push(newUser);
}

/** Returns a new array */
function mergeUserArrays(a, b) {
    const result = [];
    a.concat(b).map(u => addUserToArray(result, u));
    return result;
}

function wait(delay) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, delay);
    });
}

function fetchAFewUsers(location, year, course, offset, count) {
    const url = 'https://intra.epitech.eu/user/filter/user' +
          '?format=' + 'json' +
          '&year=' + year +
          '&location=' + location +
          '&course=' + course +
          '&count=' + count +
          '&offset=' + offset;

    return new Promise((resolve, reject) => {
        console.log(url);

        const request = httpRequest(url, {
        }, (error, response, body) => {
            if (error) {
                if (error.code === 'ETIMEDOUT' ||
                    error.code === 'ESOCKETTIMEDOUT') {
                    return wait(1000 * 10).then(() => {
                        return fetchAFewUsers(location, year, course,
                                              offset, count);
                    });
                }
                reject(error);
                return;
            }

            console.log(response.statusCode);

            const users = JSON.parse(body);
            if (!users.items)
                users.items = [];
            users.items = users.items.map(serverUser => {
                return convertServerUser(serverUser, year);
            });

            // The poor EPITECH server doesn't like to handle too many
            // requests. He'is lazy, and to do his job tires him, you
            // know. He's getting angry if we urge him too much. We
            // should wait for him slooooowly.
            wait(1000 * 2).then(() => {
                resolve(users);
            });

        });

        request.end();
    });
}

function fetchUsersRecursively(users, location, year, course, offset) {
    const count = 10000;

    return fetchAFewUsers(location, year, course, offset, count).then(result => {
        users = mergeUserArrays(users, result.items);

        if (result.items.length < count)
            return users;

        const newOffset = offset + result.items.length;
        return fetchUsersRecursively(users, location, year, course, newOffset);
    });
}

function fetchUsers(locations, years, courses) {

    function fetch(location, year, course) {
        return fetchUsersRecursively([], location, year, course, 0);
    }

    function fetchAll(combinations) {
        if (combinations.length === 0)
            return Promise.resolve([]);
        const c = combinations[0];
        return fetch(c.location, c.year, c.course).then(a => {
            return fetchAll(combinations.slice(1)).then(b => {
                return mergeUserArrays(a, b);
            });
        });
    }

    const combinations = [];
    for (let l of locations) {
        for (let y of years) {
            for (let c of courses) {
                combinations.push({location: l, year: y, course: c});
            }
        }
    }
    return fetchAll(combinations);
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



app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/user/:login', (req, res) => {
    redisClient.get('user:' + req.params.login, (err, user) => {
        if (err) {
            console.error(err);
            return;
        }

        if (!user) {
            res.status(404).end();
            return
        }

        res.set('Content-Type', 'application/json');
        res.send(user);
    });
});

function getUsersFromKey(key, callback) {
    redisClient.hget('index', key, (err, loginsString) => {
        if (err)
            return callback(err);

        if (!loginsString)
            return callback(null, []);

        const logins = loginsString.split(' ');
        const args = logins.map(l => 'user:' + l).concat((err, users) => {
            if (err)
                return callback(err);

            callback(null, users.map(JSON.parse));
        });
        redisClient.mget.apply(redisClient, args);
    });
}

function getUsersFromKeys(keys, callback) {
    // MapReduce yeah :-D

    if (keys.length === 0)
        return callback(null, []);

    const dict = {};

    function reduce() {
        let users = [];

        function hasUser(user) {
            return users.some(u => u.login === user.login);
        }

        for (let key of keys) {
            const newUsers = dict[key].filter(u => !hasUser(u));
            users = users.concat(newUsers);
        }
        callback(null, users);
    }

    for (let key of keys) {
        getUsersFromKey(key, (err, users) => {
            if (err)
                return callback(err);

            dict[key] = users;
            if (Object.keys(dict).length === keys.length)
                reduce();
        });
    }
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

function getCompletions(query, callback) {
    query = query.toLowerCase().trim();

    const words = query.split(' ');
    const wordObjects = {};

    function getUserRankByKey(user, key) {
        const userFields = ['firstName', 'lastName', 'login'];
        let rank = 0;
        for (let field of userFields) {
            const value = user[field].toLowerCase();
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
                  .map(key => key.substring(0, key.length - 1));

            wordObjects[word] = {word, keys};
            if (Object.keys(wordObjects).length === words.length) {
                reduce();
            }
        });
    }
}

app.get('/compl', (req, res) => {
    getCompletions(req.query.q, (err, completions) => {
        if (err) {
            console.error(err);
            return;
        }

        res.json(completions);
    });
});

app.use(function(req, res, next){
    res.status(404);

    if (req.accepts('html')) {
        res.send('<h1>Not found</h1>');
        return;
    }

    if (req.accepts('json')) {
        res.send({
            error: 'not_found'
        });
        return;
    }

    res.type('txt').send('Not found');
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

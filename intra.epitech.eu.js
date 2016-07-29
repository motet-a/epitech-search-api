"use strict";

const httpRequest = require('request');



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

function convertServerUser(serverUser, year) {
    return {
        login: serverUser.login,
        firstName: serverUser.prenom,
        lastName: serverUser.nom,
        location: serverUser.location,
        year,
    }
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


module.exports = {
    fetchUsers,
};

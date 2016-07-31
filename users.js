"use strict";

// `env` equals 'dev' or 'prod'
const env = require('get-env')();

const Promise = require('promise');
const fs = require('fs');

const configModule = require('./config');
const config = env === 'dev' ? configModule.dev : configModule.prod;

const {fetchUsers} = require('./intra.epitech.eu');



function fetch(locations, years, courses) {
    return fetchUsers(locations, years, courses).then(users => {
        console.log(users.length + ' users fetched.');
        return users;
    });
}

const userFileName = 'users.json';

function fetchAndSave() {
    const years = [];
    for (let y = config.firstYear; y < new Date().getFullYear() + 1; y++) {
        years.push(y);
    }

    return fetch(config.locations, years, config.courses).then(users => {

        console.log('Converting users to JSON...');
        const s = JSON.stringify(users);

        console.log('Writing users to ' + userFileName + '...');
        fs.writeFileSync(userFileName, s);
        console.log('Done.');
        return users;
    });
}

function read() {
    console.log('Reading users...');
    const s = fs.readFileSync(userFileName);

    console.log('Parsing JSON...');
    const users = JSON.parse(s);
    console.log('Done.');
    return Promise.resolve(users);
}

module.exports = {
    read,
    fetchAndSave,
};

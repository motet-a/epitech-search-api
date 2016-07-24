"use strict";


const appModule = require('./index');
const supertest = require('supertest');
const should = require('should');


function getBaseUrl() {
    const port = appModule.config.defaultPort;
    const addr = '127.0.0.1';
    return 'http://' + addr + ':' + port;
}

const url = getBaseUrl();


function request(method, path) {
    const r = supertest(url)[method](path);

    const oldEnd = r.end;

    r.end = (callback) => {
        oldEnd.call(r, ((error, response) => {
            should(error).be.exactly(null);
            callback(response);
        }));
    };
    return r;
}

function get(path) {
    return request('get', path);
}


describe('epitech-search', function () {
    this.timeout(10000);

    before((done) => {
        appModule.servePromise.then(done);
    });

    it("should return a JSON error when the route doesn't exist", (done) => {
        get('/eiuaeiuaeuiaeiuaeiuae')
            .set('Accept', 'application/json')
            .expect(404)
            .expect('Content-Type', /json/)
            .expect({
                error: 'not_found'
            })
            .end(() => done());
    });

    it("should return a HTML error when the route doesn't exist", (done) => {
        get('/eiuaeiuaeuia')
            .set('Accept', 'text/html')
            .expect(404)
            .expect('Content-Type', /html/)
            .expect(/Not found/)
            .end(() => done());
    });

    it("GET /user/:login", (done) => {
        get('/user/motet_a')
            .expect(200)
            .expect('Content-Type', /json/)
            .expect({
                login: 'motet_a',
                firstName: 'antoine',
                lastName: 'motet',
                location: 'FR/LYN',
                year: 2015,
            })
            .end(() => done());
    });

});

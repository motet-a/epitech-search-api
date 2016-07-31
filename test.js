"use strict";


let appModule; // Imported later since importing it starts the server
const usersModule = require('./users');
const supertest = require('supertest');
const should = require('should');


function getBaseUrl() {
    const port = appModule.config.defaultPort;
    const addr = '127.0.0.1';
    return 'http://' + addr + ':' + port;
}


function request(method, path) {
    const baseUrl = getBaseUrl();
    const r = supertest(baseUrl)[method](path);

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
    this.timeout(1000 * 60);

    before((done) => {
        usersModule.fetchAndSave().then(() => {
            // Importing this module starts the server
            appModule = require('./index');
            appModule.servePromise.then(done);
        });
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

    it("should return a text error when the route doesn't exist", (done) => {
        get('/eiuaeiuaeuia')
            .set('Accept', 'text/html')
            .expect(404)
            .expect('Content-Type', /text\/plain/)
            .expect(/not_found/)
            .end(() => done());
    });

    it("GET /user/:login", (done) => {
        get('/user/motet_a')
            .expect('Content-Type', /json/)
            .expect({
                login: 'motet_a',
                firstName: 'antoine',
                lastName: 'motet',
                location: 'lyon',
                course: 'bachelor/classic',
                year: 2015,
            })
            .end(() => done());
    });

    it("GET /user/ 404 with bad login", (done) => {
        get('/user/')
            .expect(404)
            .expect('Content-Type', /json/)
            .expect({
                error: 'not_found'
            })
            .end(() => done());
    });

    it("GET /user/:login 404", (done) => {
        get('/user/etsiruanetiurnateisru')
            .expect(404)
            .expect('Content-Type', /json/)
            .expect({
                error: 'not_found'
            })
            .end(() => done());
    });

    it("GET /compl without parameters", (done) => {
        get('/compl?')
            .expect(400)
            .expect('Content-Type', /json/)
            .expect({
                error: 'bad_request'
            })
            .end(() => done());
    });

    it("GET /compl with login", (done) => {
        get('/compl?q=motet_a')
            .expect('Content-Type', /json/)
            .expect((res) => {
                if (res.body[0].login !== 'motet_a')
                    throw new Error('Expected motet_a as first result');
            })
            .end(() => done());
    });

    it("GET /compl with names", (done) => {
        get('/compl?q=AnToInE+MotET')
            .expect('Content-Type', /json/)
            .expect((res) => {
                if (res.body[0].login !== 'motet_a')
                    throw new Error('Expected motet_a as first result');
            })
            .end(() => done());
    });

    it("GET /compl with date and an incomplete first name", (done) => {
        get('/compl?q=motet+2015+antoin')
            .expect('Content-Type', /json/)
            .expect((res) => {
                if (res.body[0].login !== 'motet_a')
                    throw new Error('Expected motet_a as first result');
            })
            .end(() => done());
    });

    it("GET /compl with inexistent key", (done) => {
        get('/compl?q=auieauieuiaeuiaeuaeeiuaeiuaeiu')
            .expect('Content-Type', /json/)
            .expect(200)
            .expect((res) => {
                if (res.body.length !== 0)
                    throw new Error('Expected no result');
            })
            .end(() => done());
    });

    it("GET /compl with two keys", (done) => {
        get('/compl?q=a+a')
            .expect('Content-Type', /json/)
            .expect(200)
            .expect((res) => {
                if (res.body.length !== 0)
                    throw new Error('Expected no result');
            })
            .end(() => done());
    });

    it("GET /compl with many little keys", (done) => {
        get('/compl?q=a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a')
            .expect('Content-Type', /json/)
            .expect(200)
            .expect((res) => {
                if (res.body.length !== 0)
                    throw new Error('Expected no result');
            })
            .end(() => done());
    });

    it("GET /compl with accents", (done) => {
        get('/compl?q=%C3%A0%C3%B1t%C3%B4%C3%AFn%C3%A9%20m%C3%94t%C3%8At')
            .expect('Content-Type', /json/)
            .expect(200)
            .expect((res) => {
                if (res.body[0].login !== 'motet_a')
                    throw new Error('Expected motet_a as first result');
            })
            .end(() => done());
    });

    it("should handle CORS requests", (done) => {
        get('/user/motet_a')
            .expect(200)
            .expect('Access-Control-Allow-Origin', '*')
            .end(() => done());
    });

});

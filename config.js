
module.exports = {

    prod: {
        firstYear: 2008,
        locations: [
            {code: 'FR/BDX', name: 'bordeaux'},
            {code: 'FR/LIL', name: 'lille'},
            {code: 'FR/LYN', name: 'lyon'},
            {code: 'FR/MAR', name: 'marseille'},
            {code: 'FR/NCY', name: 'nancy'},
            {code: 'FR/NAN', name: 'nantes'},
            {code: 'FR/PAR', name: 'paris'},
            {code: 'FR/REN', name: 'rennes'},
            {code: 'FR/TLS', name: 'toulouse'},
            {code: 'FR/STG', name: 'strasbourg'},
        ],
        courses: [
            'bachelor/classic',
            'master/classic',
            'webacademie',
            'Samsung-WAC',
            'bachelor/tek1ed',
            'bachelor/tek2ed',
            'bachelor/tek3s',
            'bachelor/tek3si',
            'master/tek3',
            'master/tek3si',
            // 'ISEG',
        ],

        defaultPort: 3000,
        redis: {
            host: 'redis',
        },
    },

    dev: {

        /*
         * Fetching user data from the API is really slow. In
         * development mode, less users are fetched
         */
        firstYear: 2015,
        locations: [
            {code: 'FR/LYN', name: 'lyon'},
        ],
        courses: [
            'bachelor/classic',
        ],

        defaultPort: 3000,
        redis: {
            host: 'redis',
        },
    },

}

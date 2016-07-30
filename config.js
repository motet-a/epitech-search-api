
module.exports = {

    prod: {
        firstYear: 2008,
        locations: [
            'FR/LYN',
            'FR/PAR',
        ],
        courses: [
            'bachelor/classic',
        ],

        defaultPort: 3000,
        redis: {
            host: 'localhost',
        },
    },

    dev: {

        /*
         * Fetching user data from the API is really slow. In
         * development mode, less users are fetched
         */
        firstYear: 2015,
        locations: [
            'FR/LYN',
        ],
        courses: [
            'bachelor/classic',
        ],

        defaultPort: 3000,
        redis: {
            host: 'localhost',
        },
    },

}

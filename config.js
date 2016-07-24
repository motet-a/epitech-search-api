
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
        redisHost: '172.17.0.2',
    },

    dev: {
        firstYear: 2015,
        locations: [
            'FR/LYN',
        ],
        courses: [
            'bachelor/classic',
        ],

        defaultPort: 3000,
        redisHost: '172.17.0.2',
    },

}

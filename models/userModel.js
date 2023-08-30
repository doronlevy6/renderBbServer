const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'db',
    database: 'test3',
    password: 'password',
    port: 5432,
});

module.exports = pool;

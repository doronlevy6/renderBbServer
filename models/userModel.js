// server/models/userModel.js
const { Pool } = require('pg');
require('dotenv').config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;

const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  user: PGUSER, // 'username' should be 'user'
  password: PGPASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false // This is for development purposes. Use true in production.
  },
  // The 'connection' property is not standard for pg Pool, if needed, it should be implemented differently
});

module.exports = pool;


// const { Pool } = require("pg");

// const pool = new Pool({
//   user: "bbdb_49xs_user",
//   host: "dpg-cjnpmufjbvhs738fpr8g-a.oregon-postgres.render.com",
//   database: "bbdb_49xs",
//   password: "EY2mw1Er8zoQvDtqyZyUCftUkqUypLc0",
//   port: 5432,
//   ssl: {
//     rejectUnauthorized: false, // Use this only for development purposes to accept self-signed certificates
//   },
// });

// module.exports = pool;

// server/models/userModel.js

const postgres = require('postgres');
require('dotenv').config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;

const pool = postgres({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: 'require',
  connection: {
    options: `project=${ENDPOINT_ID}`,
  },
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

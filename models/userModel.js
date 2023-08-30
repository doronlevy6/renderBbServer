// server/models/userModel.js
const { Pool } = require("pg");

const pool = new Pool({
  user: "bbdb_49xs_user",
  host: "dpg-cjnpmufjbvhs738fpr8g-a.oregon-postgres.render.com",
  database: "bbdb_49xs",
  password: "EY2mw1Er8zoQvDtqyZyUCftUkqUypLc0",
  port: 5432,
  ssl: {
    rejectUnauthorized: false, // Use this only for development purposes to accept self-signed certificates
  },
});

module.exports = pool;

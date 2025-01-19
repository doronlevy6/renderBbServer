"use strict";
// src/models/userModel.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, SSL_FALSE } = process.env;
// הגדרת SSL בהתאם למשתנה SSL_FALSE
const sslConfig = SSL_FALSE === 'false' ? false : { rejectUnauthorized: false };
const pool = new pg_1.Pool({
    host: PGHOST,
    database: PGDATABASE,
    user: PGUSER, // ודא שהמשתמש מוגדר נכון
    password: PGPASSWORD,
    port: 5432,
    ssl: sslConfig,
});
console.log('PGHOST', PGHOST);
exports.default = pool;

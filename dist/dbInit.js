"use strict";
// src/dbInit.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userModel_1 = __importDefault(require("./models/userModel"));
const createTables = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Create users table
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(255) PRIMARY KEY,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE
      );
    `);
        // Create player_rankings table
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS player_rankings (
          rater_username VARCHAR(255) NOT NULL,
          rated_username VARCHAR(255) NOT NULL,
          skill_level INTEGER,
          scoring_ability INTEGER,
          defensive_skills INTEGER,
          speed_and_agility INTEGER,
          shooting_range INTEGER,
          rebound_skills INTEGER,
          FOREIGN KEY (rater_username) REFERENCES users (username),
          FOREIGN KEY (rated_username) REFERENCES users (username),
          PRIMARY KEY (rater_username, rated_username)
      );
    `);
        // Create next_game_enlistment table
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS next_game_enlistment (
          username VARCHAR(255) PRIMARY KEY,
          enlistment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          enlistment_order INTEGER,
          FOREIGN KEY (username) REFERENCES users (username)
      );
    `);
        // Create game_teams table
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS game_teams (
          game_id SERIAL PRIMARY KEY,
          teams JSON NOT NULL
      );
    `);
        console.log('Tables created successfully!');
    }
    catch (err) {
        console.error('Error creating tables:', err);
    }
});
exports.default = createTables;

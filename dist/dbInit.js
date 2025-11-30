"use strict";
// הקוד הבא נכתב משמאל לימין
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
        // =====================================
        // NEW: Create teams table
        // Teams table will store team details including a password for joining and the team type.
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS teams (
          team_id SERIAL PRIMARY KEY,               -- team_id as primary key
          team_name VARCHAR(255) NOT NULL UNIQUE,     -- team name must be unique
          team_password VARCHAR(255) NOT NULL,        -- password/token for joining the team
          team_type VARCHAR(50) NOT NULL              -- NEW: type of the team (e.g., "Football", "Basketball")
      );
    `);
        // =====================================
        // UPDATED: Create users table with team_id foreign key
        // Now each user can be associated with a team
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(255) PRIMARY KEY,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          team_id INTEGER,                          -- NEW column for team association
          role VARCHAR(50) DEFAULT 'player',        -- NEW: role of the user (manager/player)
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE SET NULL
      );
    `);
        // =====================================
        // UPDATED: Create player_rankings table with renamed parameters
        // Renaming columns to param1 ... param6 for general representation
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS player_rankings (
          rater_username VARCHAR(255) NOT NULL,
          rated_username VARCHAR(255) NOT NULL,
          param1 INTEGER,   
          param2 INTEGER,  
          param3 INTEGER,   
          param4 INTEGER,   
          param5 INTEGER,   
          param6 INTEGER,   
          team_id INTEGER,                          -- NEW: team context for rankings
          FOREIGN KEY (rater_username) REFERENCES users(username),
          FOREIGN KEY (rated_username) REFERENCES users(username),
          FOREIGN KEY (team_id) REFERENCES teams(team_id),
          PRIMARY KEY (rater_username, rated_username)
      );
    `);
        // =====================================
        // Create next_game_enlistment table remains unchanged
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS next_game_enlistment (
          username VARCHAR(255) PRIMARY KEY,
          enlistment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          enlistment_order INTEGER,
          team_id INTEGER,                          -- NEW: team context for enlistment
          FOREIGN KEY (username) REFERENCES users(username),
          FOREIGN KEY (team_id) REFERENCES teams(team_id)
      );
    `);
        // =====================================
        // Create game_teams table remains unchanged
        // =====================================
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

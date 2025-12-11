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
        // 1. Teams Table
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS teams (
          team_id SERIAL PRIMARY KEY,
          team_name VARCHAR(255) NOT NULL UNIQUE,
          team_password VARCHAR(255) NOT NULL,
          team_type VARCHAR(50) NOT NULL,
          default_game_cost INTEGER DEFAULT 0   -- NEW: Default cost per game for this team
      );
    `);
        // =====================================
        // 2. Users Table
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(255) PRIMARY KEY,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          team_id INTEGER,
          role VARCHAR(50) DEFAULT 'player',
          custom_game_cost INTEGER,             -- NEW: Override for specific player cost
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE SET NULL
      );
    `);
        // =====================================
        // 3. Player Rankings Table
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
          team_id INTEGER,
          FOREIGN KEY (rater_username) REFERENCES users(username),
          FOREIGN KEY (rated_username) REFERENCES users(username),
          FOREIGN KEY (team_id) REFERENCES teams(team_id),
          PRIMARY KEY (rater_username, rated_username)
      );
    `);
        // =====================================
        // 4. Next Game Enlistment Table
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS next_game_enlistment (
          username VARCHAR(255) PRIMARY KEY,
          enlistment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          enlistment_order INTEGER,
          team_id INTEGER,
          FOREIGN KEY (username) REFERENCES users(username),
          FOREIGN KEY (team_id) REFERENCES teams(team_id)
      );
    `);
        // =====================================
        // 5. Game Teams Table (Pre-game team generation)
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS game_teams (
          game_id SERIAL PRIMARY KEY,
          teams JSON NOT NULL
      );
    `);
        // =====================================
        // 6. Games History Table
        // Stores the actual games that happened
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS games (
          game_id SERIAL PRIMARY KEY,
          team_id INTEGER NOT NULL,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          base_cost INTEGER NOT NULL,          -- Cost at the time of the game
          notes TEXT,
          game_session_id VARCHAR(255) UNIQUE, -- NEW: Unique identifier (YYYY-MM-DD_HH:MM)
          FOREIGN KEY (team_id) REFERENCES teams(team_id)
      );
    `);
        // =====================================
        // 7. Game Attendance Table
        // Who played in which game
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS game_attendance (
          attendance_id SERIAL PRIMARY KEY,
          game_id INTEGER NOT NULL,
          username VARCHAR(255) NOT NULL,
          applied_cost INTEGER NOT NULL,       -- The actual cost charged to this player for this game
          adjustment_note TEXT,                -- Manager note when applying a per-player override
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
          FOREIGN KEY (username) REFERENCES users(username)
      );
    `);
        // =====================================
        // 8. Payments Table
        // Money tracking
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS payments (
          payment_id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          team_id INTEGER NOT NULL,
          amount INTEGER NOT NULL,
          method VARCHAR(50) NOT NULL,          -- 'bit', 'cash', 'paybox', 'other'
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (username) REFERENCES users(username),
          FOREIGN KEY (team_id) REFERENCES teams(team_id)
      );
    `);
        console.log('Tables created successfully!');
        // Add columns if they don't exist (Migration helper for existing DBs)
        try {
            yield userModel_1.default.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS default_game_cost INTEGER DEFAULT 0;`);
            yield userModel_1.default.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_game_cost INTEGER;`);
            yield userModel_1.default.query(`ALTER TABLE game_attendance ADD COLUMN IF NOT EXISTS adjustment_note TEXT;`);
            yield userModel_1.default.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS game_session_id VARCHAR(255) UNIQUE;`);
        }
        catch (e) {
            // Ignoring error if columns exist or other migration issues
            console.log('Migration note: ' + e);
        }
    }
    catch (err) {
        console.error('Error creating tables:', err);
    }
});
exports.default = createTables;

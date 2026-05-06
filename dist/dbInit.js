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
        // 3. Refresh Tokens Table
        // Session management for secure long-lived login
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
          token_id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          team_id INTEGER NOT NULL,
          token_hash VARCHAR(255) NOT NULL UNIQUE,
          issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          revoked_at TIMESTAMP,
          user_agent TEXT,
          ip_address VARCHAR(255),
          FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
      );
    `);
        // =====================================
        // 4. Player Rankings Table
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
        // 5. Next Game Enlistment Table
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
        // 6. Game Teams Table (Pre-game team generation)
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS game_teams (
          game_id SERIAL PRIMARY KEY,
          teams JSON NOT NULL
      );
    `);
        // =====================================
        // 7. Games History Table
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
        // 8. Game Attendance Table
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
        // 9. Payments Table
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
          client_payment_id VARCHAR(255),
          notes TEXT,
          FOREIGN KEY (username) REFERENCES users(username),
          FOREIGN KEY (team_id) REFERENCES teams(team_id)
      );
    `);
        // =====================================
        // 10. Hall Payments Settings
        // Tracks gym/hall costs separately from player payments
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS hall_settings (
          team_id INTEGER PRIMARY KEY,
          default_game_cost INTEGER NOT NULL DEFAULT 200,
          tracking_start_date DATE DEFAULT '2025-10-05',
          opening_note TEXT DEFAULT 'Paid 4000 on 2025-09-11, covered through 2025-10-04',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
      );
    `);
        // =====================================
        // 11. Hall Games
        // Games that count toward hall/gym payments
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS hall_games (
          hall_game_id SERIAL PRIMARY KEY,
          team_id INTEGER NOT NULL,
          game_id INTEGER,
          game_date DATE NOT NULL,
          cost INTEGER NOT NULL,
          source VARCHAR(50) NOT NULL DEFAULT 'manual_import',
          notes TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE SET NULL
      );
    `);
        // =====================================
        // 12. Hall Payments
        // Money paid by the team manager to the hall/gym
        // =====================================
        yield userModel_1.default.query(`
      CREATE TABLE IF NOT EXISTS hall_payments (
          hall_payment_id SERIAL PRIMARY KEY,
          team_id INTEGER NOT NULL,
          amount INTEGER NOT NULL,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          notes TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
      );
    `);
        console.log('Tables created successfully!');
        // Add columns if they don't exist (Migration helper for existing DBs)
        try {
            yield userModel_1.default.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS default_game_cost INTEGER DEFAULT 0;`);
            yield userModel_1.default.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_game_cost INTEGER;`);
            yield userModel_1.default.query(`ALTER TABLE game_attendance ADD COLUMN IF NOT EXISTS adjustment_note TEXT;`);
            yield userModel_1.default.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS game_session_id VARCHAR(255) UNIQUE;`);
            yield userModel_1.default.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_payment_id VARCHAR(255);`);
            yield userModel_1.default.query(`
        CREATE INDEX IF NOT EXISTS refresh_tokens_user_team_idx
        ON refresh_tokens (username, team_id);
      `);
            yield userModel_1.default.query(`
        CREATE INDEX IF NOT EXISTS refresh_tokens_active_idx
        ON refresh_tokens (expires_at, revoked_at);
      `);
            yield userModel_1.default.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS payments_team_client_payment_id_uq
        ON payments (team_id, client_payment_id)
        WHERE client_payment_id IS NOT NULL;
      `);
            yield userModel_1.default.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS hall_games_team_game_id_uq
        ON hall_games (team_id, game_id)
        WHERE game_id IS NOT NULL;
      `);
            yield userModel_1.default.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS hall_games_team_game_date_uq
        ON hall_games (team_id, game_date);
      `);
            yield userModel_1.default.query(`
        CREATE INDEX IF NOT EXISTS hall_payments_team_date_idx
        ON hall_payments (team_id, date);
      `);
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

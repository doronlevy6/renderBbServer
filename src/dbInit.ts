// הקוד הבא נכתב משמאל לימין

import pool from './models/userModel';

const createTables = async (): Promise<void> => {
  try {
    // =====================================
    // 1. Teams Table
    // =====================================
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_teams (
          game_id SERIAL PRIMARY KEY,
          teams JSON NOT NULL
      );
    `);

    // =====================================
    // 6. Games History Table
    // Stores the actual games that happened
    // =====================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
          game_id SERIAL PRIMARY KEY,
          team_id INTEGER NOT NULL,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          base_cost INTEGER NOT NULL,          -- Cost at the time of the game
          notes TEXT,
          FOREIGN KEY (team_id) REFERENCES teams(team_id)
      );
    `);

    // =====================================
    // 7. Game Attendance Table
    // Who played in which game
    // =====================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_attendance (
          attendance_id SERIAL PRIMARY KEY,
          game_id INTEGER NOT NULL,
          username VARCHAR(255) NOT NULL,
          applied_cost INTEGER NOT NULL,       -- The actual cost charged to this player for this game
          FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
          FOREIGN KEY (username) REFERENCES users(username)
      );
    `);

    // =====================================
    // 8. Payments Table
    // Money tracking
    // =====================================
    await pool.query(`
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
      await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS default_game_cost INTEGER DEFAULT 0;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_game_cost INTEGER;`);
    } catch (e) {
      // Ignoring error if columns exist or other migration issues
      console.log('Migration note: ' + e);
    }

  } catch (err: any) {
    console.error('Error creating tables:', err);
  }
};

export default createTables;

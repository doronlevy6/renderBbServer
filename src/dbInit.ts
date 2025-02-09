// הקוד הבא נכתב משמאל לימין

import pool from './models/userModel';

const createTables = async (): Promise<void> => {
  try {
    // =====================================
    // NEW: Create teams table
    // Teams table will store team details including a password for joining and the team type.
    // =====================================
    await pool.query(`
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(255) PRIMARY KEY,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          team_id INTEGER,                          -- NEW column for team association
          FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE SET NULL
      );
    `);

    // =====================================
    // UPDATED: Create player_rankings table with renamed parameters
    // Renaming columns to param1 ... param6 for general representation
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
          FOREIGN KEY (rater_username) REFERENCES users(username),
          FOREIGN KEY (rated_username) REFERENCES users(username),
          PRIMARY KEY (rater_username, rated_username)
      );
    `);

    // =====================================
    // Create next_game_enlistment table remains unchanged
    // =====================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS next_game_enlistment (
          username VARCHAR(255) PRIMARY KEY,
          enlistment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          enlistment_order INTEGER,
          FOREIGN KEY (username) REFERENCES users(username)
      );
    `);

    // =====================================
    // Create game_teams table remains unchanged
    // =====================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_teams (
          game_id SERIAL PRIMARY KEY,
          teams JSON NOT NULL
      );
    `);

    console.log('Tables created successfully!');
  } catch (err: any) {
    console.error('Error creating tables:', err);
  }
};

export default createTables;

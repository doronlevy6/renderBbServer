// הקוד הבא נכתב משמאל לימין

import { Client } from 'pg';
import pool from '../models/userModel';

// הגדרת ממשקים (Interfaces) לטיפוסים של המשתמשים והדירוגים
interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  team_id: number;
  role: string;
}

// UPDATED: עדכון שמות הפרמטרים למצב כללי (param1 עד param6)
interface Ranking {
  username: string;
  param1: number; // was skillLevel
  param2: number; // was scoringAbility
  param3: number; // was defensiveSkills
  param4: number; // was speedAndAgility
  param5: number; // was shootingRange
  param6: number; // was reboundSkills
  // שדות נוספים במידת הצורך
}

// UPDATED: עדכון ממשק דירוגי שחקנים
interface PlayerRankings {
  rater_username: string;
  rated_username: string;
  param1: number; // was skill_level
  param2: number; // was scoring_ability
  param3: number; // was defensive_skills
  param4: number; // was speed_and_agility
  param5: number; // was shooting_range
  param6: number; // was rebound_skills
}

class UserService {
  // יצירת משתמש חדש
  public async createUser(
    username: string,
    password: string,
    email: string,
    teamId?: number, // NEW: Optional team parameter
    role: string = 'player' // NEW: Optional role parameter, default to 'player'
  ): Promise<User> {
    try {
      // Check if username already exists
      const existingUser = await pool.query(
        'SELECT username FROM users WHERE username = $1',
        [username]
      );

      if (existingUser.rows.length > 0) {
        throw new Error(
          'Username already exists. Please choose a different one.'
        );
      }

      // Insert new user if username is available
      // Use NULL for empty email to avoid duplicate key constraint violations
      const result = await pool.query(
        'INSERT INTO users (username, password, email, team_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [username, password, email || null, teamId || null, role]
      );

      return result.rows[0];
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Failed to create user');
    }
  }

  // התחברות משתמש
  // Backend: עדכון המתודה loginUser לביצוע join עם טבלת teams
  public async loginUser(
    username: string,
    password: string
  ): Promise<User | null> {
    try {
      const result = await pool.query(
        `SELECT users.*, teams.team_type FROM users
       LEFT JOIN teams ON users.team_id = teams.team_id
       WHERE username = $1`,
        [username]
      );

      const user: User = result.rows[0];
      if (user && user.password === password) {
        return user;
      } else {
        return null;
      }
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to authenticate user');
    }
  }

  // קבלת כל שמות המשתמשים
  public async getAllUsernames(
    teamId: number
  ): Promise<{ username: string }[]> {
    try {
      const result = await pool.query(
        `SELECT username FROM users
          WHERE team_id=$1 
          ORDER BY username ASC`,
        [teamId]
      );
      return result.rows;
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch usernames');
    }
  }

  // קבלת כל המשתמשים (לניהול)
  public async getAllUsers(teamId: number): Promise<User[]> {
    try {
      const result = await pool.query(
        `SELECT username, email, password, team_id FROM users
          WHERE team_id=$1 
          ORDER BY username ASC`,
        [teamId]
      );
      return result.rows;
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch users');
    }
  }

  // אחסון דירוגי שחקנים
  public async storePlayerRankings(
    rater_username: string,
    rankings: Ranking[],
    teamId: number
  ): Promise<void> {
    try {
      // Delete existing rankings for the rater
      await pool.query(
        'DELETE FROM player_rankings WHERE rater_username = $1',
        [rater_username]
      );

      for (let ranking of rankings) {
        // UPDATED: destructuring with new param names
        const {
          username,
          param1, // was skillLevel
          param2, // was scoringAbility
          param3, // was defensiveSkills
          param4, // was speedAndAgility
          param5, // was shootingRange
          param6, // was reboundSkills
        } = ranking;
        await pool.query(
          // UPDATED: use new column names param1 ... param6
          'INSERT INTO player_rankings (rater_username, rated_username, param1, param2, param3, param4, param5, param6, team_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [
            rater_username,
            username,
            param1,
            param2,
            param3,
            param4,
            param5,
            param6,
            teamId
          ]
        );
      }
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to store player rankings');
    }
  }

  // קבלת דירוגי שחקנים לפי משתמש
  public async getPlayerRankings(username: string): Promise<PlayerRankings[]> {
    try {
      const result = await pool.query(
        // UPDATED: select returns new param names
        'SELECT * FROM player_rankings WHERE rater_username = $1',
        [username]
      );
      return result.rows;
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch player rankings');
    }
  }

  // קבלת כל המשתמשים הרשומים למשחק הבא
  public async getAllEnlistedUsers(teamId: number): Promise<string[]> {
    try {
      const result = await pool.query(
        `SELECT n.username 
       FROM next_game_enlistment n
       JOIN users u ON n.username = u.username
       WHERE u.team_id = $1 
       ORDER BY n.enlistment_order ASC`,
        [teamId]
      );
      return result.rows.map((row: { username: string }) => row.username);
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch enlisted users');
    }
  }

  // מחיקת משתמשים רשומים
  public async deleteEnlistedUsers(usernames: string[]): Promise<void> {
    try {
      await pool.query(
        'DELETE FROM next_game_enlistment WHERE username = ANY($1::text[])',
        [usernames]
      );
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to delete enlisted users');
    }
  }

  // הרשמה למשתמשים למשחק הבא
  public async enlistUsersBox(usernames: string[], teamId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        'SELECT COALESCE(MAX(enlistment_order), 0) AS max_order FROM next_game_enlistment'
      );
      let currentOrder: number = res.rows[0].max_order;

      const insertQuery = `
        INSERT INTO next_game_enlistment (username, enlistment_order, team_id)
        VALUES ($1, $2, $3)
      `;

      for (const username of usernames) {
        currentOrder += 1;
        await client.query(insertQuery, [username, currentOrder, teamId]);
      }

      await client.query('COMMIT');
      return true;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(err);
      throw new Error('Failed to enlist users for next game');
    } finally {
      client.release();
    }
  }
  public async getAllTeams() {
    const query = 'SELECT team_id, team_name FROM teams';
    const result = await pool.query(query);
    return result.rows;
  }

  // מחיקת משתמש (שחקן)
  public async deleteUser(username: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cleanUsername = username.trim();

      // Delete from player_rankings (both as rater and rated)
      await client.query('DELETE FROM player_rankings WHERE rater_username = $1 OR rated_username = $1', [cleanUsername]);

      // Delete from next_game_enlistment
      await client.query('DELETE FROM next_game_enlistment WHERE username = $1', [cleanUsername]);

      // Delete from users
      await client.query('DELETE FROM users WHERE username = $1', [cleanUsername]);

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(err);
      throw new Error('Failed to delete user');
    } finally {
      client.release();
    }
  }

  // עדכון פרטי משתמש (שחקן)
  public async updateUser(currentUsername: string, newUsername: string, newEmail?: string, newPassword?: string): Promise<User> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if username is changing
      if (currentUsername !== newUsername) {
        // Check if new username already exists
        const existing = await client.query('SELECT username FROM users WHERE username = $1', [newUsername]);
        if (existing.rows.length > 0) {
          throw new Error('Username already exists');
        }

        // Get current user details
        const currentUserRes = await client.query('SELECT * FROM users WHERE username = $1', [currentUsername]);
        if (currentUserRes.rows.length === 0) throw new Error('User not found');
        const currentUser = currentUserRes.rows[0];

        // Prepare new values
        const emailToUse = newEmail !== undefined ? newEmail : currentUser.email;
        const passwordToUse = newPassword !== undefined ? newPassword : currentUser.password;
        const teamIdToUse = currentUser.team_id;

        // Create new user with a temporary unique email to satisfy NOT NULL and UNIQUE constraints
        const tempEmail = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}@placeholder.com`;
        const roleToUse = currentUser.role;

        await client.query(
          'INSERT INTO users (username, password, email, team_id, role) VALUES ($1, $2, $3, $4, $5)',
          [newUsername, passwordToUse, tempEmail, teamIdToUse, roleToUse]
        );

        // Update dependent tables to point to new user
        await client.query('UPDATE player_rankings SET rater_username = $1 WHERE rater_username = $2', [newUsername, currentUsername]);
        await client.query('UPDATE player_rankings SET rated_username = $1 WHERE rated_username = $2', [newUsername, currentUsername]);
        await client.query('UPDATE next_game_enlistment SET username = $1 WHERE username = $2', [newUsername, currentUsername]);

        // Delete old user
        await client.query('DELETE FROM users WHERE username = $1', [currentUsername]);

        // Now update the email of the new user to the correct one
        await client.query('UPDATE users SET email = $1 WHERE username = $2', [emailToUse, newUsername]);

        await client.query('COMMIT');

        return { ...currentUser, username: newUsername, email: emailToUse, password: passwordToUse };
      } else {
        // Just updating email/password
        const result = await client.query(
          'UPDATE users SET email = COALESCE($1, email), password = COALESCE($2, password) WHERE username = $3 RETURNING *',
          [newEmail, newPassword, currentUsername]
        );

        if (result.rows.length === 0) {
          throw new Error('User not found');
        }

        await client.query('COMMIT');
        return result.rows[0];
      }
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(err);
      throw new Error(err.message || 'Failed to update user');
    } finally {
      client.release();
    }
  }
}

const userService = new UserService();

export default userService;

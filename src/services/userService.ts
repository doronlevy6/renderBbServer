// הקוד הבא נכתב משמאל לימין

import pool from '../models/userModel';

// הגדרת ממשקים (Interfaces) לטיפוסים של המשתמשים והדירוגים
interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  team_id: number;
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
    teamId?: number // NEW: פרמטר אופציונלי לקבוצה
  ): Promise<User> {
    try {
      const result = await pool.query(
        'INSERT INTO users (username, password, email, team_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [username, password, email, teamId || null]
      );
      return result.rows[0];
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to create user');
    }
  }

  // התחברות משתמש
  public async loginUser(
    username: string,
    password: string
  ): Promise<User | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
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

  // אחסון דירוגי שחקנים
  public async storePlayerRankings(
    rater_username: string,
    rankings: Ranking[]
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
          'INSERT INTO player_rankings (rater_username, rated_username, param1, param2, param3, param4, param5, param6) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [
            rater_username,
            username,
            param1,
            param2,
            param3,
            param4,
            param5,
            param6,
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
  public async enlistUsersBox(usernames: string[]): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        'SELECT COALESCE(MAX(enlistment_order), 0) AS max_order FROM next_game_enlistment'
      );
      let currentOrder: number = res.rows[0].max_order;

      const insertQuery = `
        INSERT INTO next_game_enlistment (username, enlistment_order)
        VALUES ($1, $2)
      `;

      for (const username of usernames) {
        currentOrder += 1;
        await client.query(insertQuery, [username, currentOrder]);
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
}

const userService = new UserService();

export default userService;

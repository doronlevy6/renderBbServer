// src/services/userService.ts

import pool from '../models/userModel';

// הגדרת ממשקים (Interfaces) לטיפוסים של המשתמשים והדירוגים
interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  // שדות נוספים אם יש
}

interface Ranking {
  username: string;
  skillLevel: number;
  scoringAbility: number;
  defensiveSkills: number;
  speedAndAgility: number;
  shootingRange: number;
  reboundSkills: number;
  // שדות נוספים במידת הצורך
}

interface PlayerRankings {
  rater_username: string;
  rated_username: string;
  skill_level: number;
  scoring_ability: number;
  defensive_skills: number;
  speed_and_agility: number;
  shooting_range: number;
  rebound_skills: number;
}

class UserService {
  // יצירת משתמש חדש
  public async createUser(
    username: string,
    password: string,
    email: string
  ): Promise<User> {
    try {
      const result = await pool.query(
        'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING *',
        [username, password, email]
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
        // **שים לב:** בשימוש אמיתי, יש להצפין את הסיסמה ולבדוק ערכים מוצפנים.
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
  public async getAllUsernames(): Promise<{ username: string }[]> {
    try {
      const result = await pool.query(
        'SELECT username FROM users ORDER BY username ASC'
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
      await pool.query(
        'DELETE FROM player_rankings WHERE rater_username = $1',
        [rater_username]
      );

      for (let ranking of rankings) {
        const {
          username,
          skillLevel,
          scoringAbility,
          defensiveSkills,
          speedAndAgility,
          shootingRange,
          reboundSkills,
        } = ranking;
        await pool.query(
          'INSERT INTO player_rankings (rater_username, rated_username, skill_level, scoring_ability, defensive_skills, speed_and_agility, shooting_range, rebound_skills) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [
            rater_username,
            username,
            skillLevel,
            scoringAbility,
            defensiveSkills,
            speedAndAgility,
            shootingRange,
            reboundSkills,
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
        'SELECT * FROM player_rankings WHERE rater_username = $1',
        [username]
      );
      return result.rows;
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch player rankings');
    }
  }

  // קבלת דירוגי שחקנים לפי מדרג
  public async getPlayerRankingsByRater(
    rater_username: string
  ): Promise<any[]> {
    // ניתן להגדיר ממשק מתאים
    try {
      const result = await pool.query(
        `SELECT u.username, pr.skill_level, pr.scoring_ability, pr.defensive_skills, pr.speed_and_agility, pr.shooting_range, pr.rebound_skills
         FROM users u
         LEFT JOIN player_rankings pr ON u.username = pr.rated_username AND pr.rater_username = $1`,
        [rater_username]
      );
      return result.rows;
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch player rankings');
    }
  }

  // קבלת כל המשתמשים הרשומים למשחק הבא
  public async getAllEnlistedUsers(): Promise<string[]> {
    try {
      const result = await pool.query(
        'SELECT username FROM next_game_enlistment ORDER BY enlistment_order ASC'
      );
      return result.rows.map((row: { username: string }) => row.username); // Return an array of usernames
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
    console.log('Enlisting users...');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch the current maximum enlistment_order
      const res = await client.query(
        'SELECT COALESCE(MAX(enlistment_order), 0) AS max_order FROM next_game_enlistment'
      );
      let currentOrder: number = res.rows[0].max_order;

      // Prepare the INSERT query
      const insertQuery = `
        INSERT INTO next_game_enlistment (username, enlistment_order)
        VALUES ($1, $2)
      `;

      for (const username of usernames) {
        currentOrder += 1;
        await client.query(insertQuery, [username, currentOrder]);
      }

      await client.query('COMMIT');
      return true; // Return true if all inserts were successful
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(err);
      throw new Error('Failed to enlist users for next game');
    } finally {
      client.release();
    }
  }

  // קבלת צוותים
  public async getTeams(): Promise<any> {
    // ניתן להגדיר ממשק מתאים
    try {
      // Fetch the last row by ordering by game_id in descending order and limiting the result to one row
      const result = await pool.query(
        'SELECT teams FROM game_teams ORDER BY game_id DESC LIMIT 1'
      );

      if (result.rows.length > 0) {
        return result.rows[0].teams; // Return the teams field from the last row
      } else {
        throw new Error('No teams found');
      }
    } catch (err: any) {
      console.error(err);
      throw err; // Propagate the error to be handled by the caller
    }
  }
}

const userService = new UserService();

export default userService;

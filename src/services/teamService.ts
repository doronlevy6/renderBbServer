// src/services/teamService.ts

import pool from '../models/userModel'; // נניח שאותו pool מתחבר למסד הנתונים

interface Team {
  team_id: number;
  team_name: string;
  team_password: string;
  team_type: string;
}

class TeamService {
  // פונקציה ליצירת קבוצה חדשה
  public async createTeam(
    team_name: string,
    team_password: string,
    team_type: string
  ): Promise<Team> {
    try {
      const result = await pool.query(
        `INSERT INTO teams (team_name, team_password, team_type)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [team_name, team_password, team_type]
      );
      return result.rows[0];
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to create team');
    }
  }
  // ב-teamService.ts
  public async getTeamByName(teamName: string): Promise<Team | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM teams WHERE team_name = $1',
        [teamName]
      );
      return result.rows[0] || null;
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to get team by name');
    }
  }
}

export default new TeamService();

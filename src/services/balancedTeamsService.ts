// src/services/balancedTeamsService.ts

import pool from '../models/userModel';
import { Server as SocketIOServer } from 'socket.io';

// UPDATED: עדכון ממשק השחקן לשימוש במפתחות החדשים (param1 עד param6)
interface Player {
  username: string;
  param1: number; // היה: skill_level
  param2: number; // היה: scoring_ability
  param3: number; // היה: defensive_skills
  param4: number; // היה: speed_and_agility
  param5: number; // היה: shooting_range
  param6: number; // היה: rebound_skills
}

type Team = Player[];

class BalancedTeamsService {
  // UPDATED: עדכון השאילתה לשימוש בעמודות החדשות param1 ... param6
  public async getAllPlayersRankingsFromUser(
    raterUsername: string,
    teamId: number
  ): Promise<Player[]> {
    try {
      const result = await pool.query(
        `SELECT   
          pr.rated_username AS username, 
          AVG(pr.param1) AS param1,
          AVG(pr.param2) AS param2, 
          AVG(pr.param3) AS param3,
          AVG(pr.param4) AS param4, 
          AVG(pr.param5) AS param5,
          AVG(pr.param6) AS param6
        FROM player_rankings pr
        JOIN users u ON pr.rated_username = u.username
        WHERE pr.rater_username = $1 AND u.team_id = $2
        GROUP BY pr.rated_username`,
        [raterUsername, teamId]
      );
      return result.rows as Player[];
    } catch (err: any) {
      console.error(err);
      throw new Error(
        `Failed to fetch player rankings from rater '${raterUsername}'`
      );
    }
  }

  // UPDATED: עדכון השאילתה לשימוש במפתחות החדשים
  public async getAllPlayersRankings(teamId: number): Promise<Player[]> {
    try {
      const result = await pool.query(
        `SELECT   
          pr.rated_username AS username, 
          AVG(pr.param1) AS param1,
          AVG(pr.param2) AS param2, 
          AVG(pr.param3) AS param3,
          AVG(pr.param4) AS param4, 
          AVG(pr.param5) AS param5,
          AVG(pr.param6) AS param6
        FROM player_rankings pr
        JOIN users u ON pr.rated_username = u.username
        WHERE u.team_id = $1
        GROUP BY pr.rated_username`,
        [teamId]
      );
      return result.rows as Player[];
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch player rankings for the team');
    }
  }
}

const balancedTeamsService = new BalancedTeamsService();
export default balancedTeamsService;

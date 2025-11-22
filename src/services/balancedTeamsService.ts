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
          u.username, 
          COALESCE(AVG(pr.param1), 0) AS param1,
          COALESCE(AVG(pr.param2), 0) AS param2, 
          COALESCE(AVG(pr.param3), 0) AS param3,
          COALESCE(AVG(pr.param4), 0) AS param4, 
          COALESCE(AVG(pr.param5), 0) AS param5,
          COALESCE(AVG(pr.param6), 0) AS param6
        FROM users u
        LEFT JOIN player_rankings pr ON u.username = pr.rated_username AND pr.rater_username = $1
        WHERE u.team_id = $2
        GROUP BY u.username`,
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
          u.username, 
          COALESCE(AVG(pr.param1), 0) AS param1,
          COALESCE(AVG(pr.param2), 0) AS param2, 
          COALESCE(AVG(pr.param3), 0) AS param3,
          COALESCE(AVG(pr.param4), 0) AS param4, 
          COALESCE(AVG(pr.param5), 0) AS param5,
          COALESCE(AVG(pr.param6), 0) AS param6
        FROM users u
        LEFT JOIN player_rankings pr ON u.username = pr.rated_username
        WHERE u.team_id = $1
        GROUP BY u.username`,
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

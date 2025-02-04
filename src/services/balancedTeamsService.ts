// src/services/balancedTeamsService.ts

import pool from '../models/userModel';
import { Server as SocketIOServer } from 'socket.io';

// Define interfaces
interface Player {
  username: string;
  skill_level: number;
  scoring_ability: number;
  defensive_skills: number;
  speed_and_agility: number;
  shooting_range: number;
  rebound_skills: number;
}

type Team = Player[];

class BalancedTeamsService {
  public async getAllPlayersRankingsFromUser(
    raterUsername: string,
    teamId: number
  ): Promise<Player[]> {
    try {
      const result = await pool.query(
        `SELECT   
          pr.rated_username AS username, 
          AVG(pr.skill_level) AS skill_level,
          AVG(pr.scoring_ability) AS scoring_ability, 
          AVG(pr.defensive_skills) AS defensive_skills,
          AVG(pr.speed_and_agility) AS speed_and_agility, 
          AVG(pr.shooting_range) AS shooting_range,
          AVG(pr.rebound_skills) AS rebound_skills
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

  public async getAllPlayersRankings(teamId: number): Promise<Player[]> {
    try {
      const result = await pool.query(
        `SELECT   
          pr.rated_username AS username, 
          AVG(pr.skill_level) AS skill_level,
          AVG(pr.scoring_ability) AS scoring_ability, 
          AVG(pr.defensive_skills) AS defensive_skills,
          AVG(pr.speed_and_agility) AS speed_and_agility, 
          AVG(pr.shooting_range) AS shooting_range,
          AVG(pr.rebound_skills) AS rebound_skills
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

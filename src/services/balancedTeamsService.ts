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
  // public async setBalancedTeams(
  //   io: SocketIOServer,
  //   isTierMethod: boolean
  // ): Promise<Team[]> {
  //   try {
  //     // Fetch all players and their rankings
  //     const result = await pool.query(
  //       `SELECT
  //         n.username,
  //         AVG(pr.skill_level) AS skill_level,
  //         AVG(pr.scoring_ability) AS scoring_ability,
  //         AVG(pr.defensive_skills) AS defensive_skills,
  //         AVG(pr.speed_and_agility) AS speed_and_agility,
  //         AVG(pr.shooting_range) AS shooting_range,
  //         AVG(pr.rebound_skills) AS rebound_skills
  //       FROM next_game_enlistment n
  //       LEFT JOIN player_rankings pr ON n.username = pr.rated_username
  //       WHERE pr.rater_username IN ('doron')
  //       GROUP BY n.username
  //       `
  //     );
  //     const players: Player[] = result.rows;

  //     // Filter out players with null parameters
  //     const validPlayers: Player[] = players.filter(
  //       (player) =>
  //         player.skill_level != null &&
  //         player.scoring_ability != null &&
  //         player.defensive_skills != null &&
  //         player.speed_and_agility != null &&
  //         player.shooting_range != null &&
  //         player.rebound_skills != null
  //     );

  //     // Sort the valid players by total ranking
  //     validPlayers.sort(
  //       (a, b) => this.computeTotalRanking(b) - this.computeTotalRanking(a)
  //     );

  //     // Take the first 12 players
  //     const top12Players: Player[] = validPlayers.slice(0, 12);

  //     const distributedTeams: Team[] = !isTierMethod
  //       ? this.distributePlayers(top12Players)
  //       : this.distributePlayersTier(top12Players);

  //     // Distribute the valid players to the teams
  //     await this.saveTeamsToDB(distributedTeams);
  //     io.emit('teamsUpdated');

  //     return distributedTeams;
  //   } catch (err: any) {
  //     console.error(err);
  //     throw new Error('Failed to fetch teams');
  //   }
  // }

  // private computeTotalRanking(player: Player): number {
  //   return (
  //     player.skill_level +
  //     player.scoring_ability +
  //     player.defensive_skills +
  //     player.speed_and_agility +
  //     player.shooting_range +
  //     player.rebound_skills
  //   );
  // }

  // private distributePlayersTier(players: Player[]): Team[] {
  //   const numTeams: number = players.length === 12 ? 3 : 2;
  //   const teams: Team[] = Array.from({ length: numTeams }, () => []);

  //   // Function to calculate a team's total ranking
  //   const teamTotalRanking = (team: Team): number =>
  //     team.reduce(
  //       (total, player) => total + this.computeTotalRanking(player),
  //       0
  //     );

  //   // Distribute players to the teams to balance total ranking
  //   for (const player of players) {
  //     // Find the team with the lowest total ranking
  //     let lowestTeamIndex: number = 0;
  //     let lowestTeamRanking: number = teamTotalRanking(teams[0]);
  //     for (let i = 1; i < numTeams; i++) {
  //       const teamRanking = teamTotalRanking(teams[i]);
  //       if (teamRanking < lowestTeamRanking) {
  //         lowestTeamIndex = i;
  //         lowestTeamRanking = teamRanking;
  //       }
  //     }

  //     // Add the player to the team with the lowest total ranking
  //     teams[lowestTeamIndex].push(player);
  //   }

  //   return teams;
  // }

  // private async saveTeamsToDB(teams: Team[]): Promise<void> {
  //   try {
  //     // Convert the teams object to a JSON string
  //     const teamsJSON: string = JSON.stringify(teams);

  //     // Insert the JSON string into the game_teams table
  //     await pool.query(`INSERT INTO game_teams (teams) VALUES ($1)`, [
  //       teamsJSON,
  //     ]);
  //   } catch (err: any) {
  //     throw err;
  //   }
  // }

  public async getAllPlayersRankingsFromUser(
    username: string
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
        WHERE pr.rater_username = $1
        GROUP BY pr.rated_username`,
        [username]
      );
      return result.rows as Player[];
    } catch (err: any) {
      console.error(err);
      throw new Error(
        `Failed to fetch player rankings from rater '${username}'`
      );
    }
  }

  public async getAllPlayersRankings(): Promise<Player[]> {
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
        GROUP BY pr.rated_username`
      );
      return result.rows as Player[];
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch player rankings from all raters');
    }
  }
}

const balancedTeamsService = new BalancedTeamsService();

export default balancedTeamsService;

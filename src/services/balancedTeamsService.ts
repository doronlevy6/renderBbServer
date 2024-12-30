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
  public async setBalancedTeams(
    io: SocketIOServer,
    isTierMethod: boolean
  ): Promise<Team[]> {
    try {
      // Fetch all players and their rankings
      const result = await pool.query(
        `SELECT   
          n.username, 
          AVG(pr.skill_level) AS skill_level,
          AVG(pr.scoring_ability) AS scoring_ability, 
          AVG(pr.defensive_skills) AS defensive_skills,
          AVG(pr.speed_and_agility) AS speed_and_agility, 
          AVG(pr.shooting_range) AS shooting_range,
          AVG(pr.rebound_skills) AS rebound_skills
        FROM next_game_enlistment n
        LEFT JOIN player_rankings pr ON n.username = pr.rated_username
        WHERE pr.rater_username IN ('doron')
        GROUP BY n.username
        `
      );
      const players: Player[] = result.rows;

      // Filter out players with null parameters
      const validPlayers: Player[] = players.filter(
        (player) =>
          player.skill_level != null &&
          player.scoring_ability != null &&
          player.defensive_skills != null &&
          player.speed_and_agility != null &&
          player.shooting_range != null &&
          player.rebound_skills != null
      );

      // Sort the valid players by total ranking
      validPlayers.sort(
        (a, b) => this.computeTotalRanking(b) - this.computeTotalRanking(a)
      );

      // Take the first 12 players
      const top12Players: Player[] = validPlayers.slice(0, 12);

      const distributedTeams: Team[] = !isTierMethod
        ? this.distributePlayers(top12Players)
        : this.distributePlayersTier(top12Players);

      // Distribute the valid players to the teams
      await this.saveTeamsToDB(distributedTeams);
      io.emit('teamsUpdated');

      return distributedTeams;
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to fetch teams');
    }
  }

  private computeTotalRanking(player: Player): number {
    return (
      player.skill_level +
      player.scoring_ability +
      player.defensive_skills +
      player.speed_and_agility +
      player.shooting_range +
      player.rebound_skills
    );
  }

  private distributePlayers(players: Player[]): Team[] {
    const numTeams: number = players.length === 12 ? 3 : 2;
    const teams: Team[] = Array.from({ length: numTeams }, () => []);

    // Calculate the average of each attribute across all players
    const averages: { [key in keyof Omit<Player, 'username'>]: number } = {
      skill_level: 0,
      scoring_ability: 0,
      defensive_skills: 0,
      speed_and_agility: 0,
      shooting_range: 0,
      rebound_skills: 0,
    };

    for (const player of players) {
      for (const attr in averages) {
        averages[attr as keyof Omit<Player, 'username'>] +=
          player[attr as keyof Omit<Player, 'username'>];
      }
    }

    for (const attr in averages) {
      averages[attr as keyof Omit<Player, 'username'>] /= players.length;
    }

    // Function to calculate a team's total score in an attribute
    const teamScore = (
      team: Team,
      attr: keyof Omit<Player, 'username'>
    ): number => team.reduce((score, player) => score + player[attr], 0);

    // Distribute players to the teams that most need them
    for (const player of players) {
      // Find the attribute that this player is strongest in
      let strongestAttr: keyof Omit<Player, 'username'> = 'skill_level';
      let strongestVal: number = player.skill_level;
      for (const attr in averages) {
        const currentAttr = attr as keyof Omit<Player, 'username'>;
        if (player[currentAttr] > strongestVal) {
          strongestAttr = currentAttr;
          strongestVal = player[currentAttr];
        }
      }

      // Find the team that is furthest below the average in this attribute and has fewer than 4 players
      let bestTeamIndex: number = -1;
      let bestTeamScore: number = Infinity;
      for (let i = 0; i < numTeams; i++) {
        const score = teamScore(teams[i], strongestAttr);
        if (teams[i].length < 4 && score < bestTeamScore) {
          bestTeamIndex = i;
          bestTeamScore = score;
        }
      }

      if (bestTeamIndex >= 0) {
        teams[bestTeamIndex].push(player);
      } else {
        // Handle any remaining players here
        console.log('No suitable team found for player', player.username);
      }
    }

    return teams;
  }

  private distributePlayersTier(players: Player[]): Team[] {
    const numTeams: number = players.length === 12 ? 3 : 2;
    const teams: Team[] = Array.from({ length: numTeams }, () => []);

    // Function to calculate a team's total ranking
    const teamTotalRanking = (team: Team): number =>
      team.reduce(
        (total, player) => total + this.computeTotalRanking(player),
        0
      );

    // Distribute players to the teams to balance total ranking
    for (const player of players) {
      // Find the team with the lowest total ranking
      let lowestTeamIndex: number = 0;
      let lowestTeamRanking: number = teamTotalRanking(teams[0]);
      for (let i = 1; i < numTeams; i++) {
        const teamRanking = teamTotalRanking(teams[i]);
        if (teamRanking < lowestTeamRanking) {
          lowestTeamIndex = i;
          lowestTeamRanking = teamRanking;
        }
      }

      // Add the player to the team with the lowest total ranking
      teams[lowestTeamIndex].push(player);
    }

    return teams;
  }

  private async saveTeamsToDB(teams: Team[]): Promise<void> {
    try {
      // Convert the teams object to a JSON string
      const teamsJSON: string = JSON.stringify(teams);

      // Insert the JSON string into the game_teams table
      await pool.query(`INSERT INTO game_teams (teams) VALUES ($1)`, [
        teamsJSON,
      ]);
    } catch (err: any) {
      throw err;
    }
  }

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

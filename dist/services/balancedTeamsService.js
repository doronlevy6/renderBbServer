"use strict";
// src/services/balancedTeamsService.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userModel_1 = __importDefault(require("../models/userModel"));
class BalancedTeamsService {
    setBalancedTeams(io, isTierMethod) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Fetch all players and their rankings
                const result = yield userModel_1.default.query(`SELECT   
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
        `);
                const players = result.rows;
                // Filter out players with null parameters
                const validPlayers = players.filter((player) => player.skill_level != null &&
                    player.scoring_ability != null &&
                    player.defensive_skills != null &&
                    player.speed_and_agility != null &&
                    player.shooting_range != null &&
                    player.rebound_skills != null);
                // Sort the valid players by total ranking
                validPlayers.sort((a, b) => this.computeTotalRanking(b) - this.computeTotalRanking(a));
                // Take the first 12 players
                const top12Players = validPlayers.slice(0, 12);
                const distributedTeams = !isTierMethod
                    ? this.distributePlayers(top12Players)
                    : this.distributePlayersTier(top12Players);
                // Distribute the valid players to the teams
                yield this.saveTeamsToDB(distributedTeams);
                io.emit('teamsUpdated');
                return distributedTeams;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch teams');
            }
        });
    }
    computeTotalRanking(player) {
        return (player.skill_level +
            player.scoring_ability +
            player.defensive_skills +
            player.speed_and_agility +
            player.shooting_range +
            player.rebound_skills);
    }
    distributePlayers(players) {
        const numTeams = players.length === 12 ? 3 : 2;
        const teams = Array.from({ length: numTeams }, () => []);
        // Calculate the average of each attribute across all players
        const averages = {
            skill_level: 0,
            scoring_ability: 0,
            defensive_skills: 0,
            speed_and_agility: 0,
            shooting_range: 0,
            rebound_skills: 0,
        };
        for (const player of players) {
            for (const attr in averages) {
                averages[attr] +=
                    player[attr];
            }
        }
        for (const attr in averages) {
            averages[attr] /= players.length;
        }
        // Function to calculate a team's total score in an attribute
        const teamScore = (team, attr) => team.reduce((score, player) => score + player[attr], 0);
        // Distribute players to the teams that most need them
        for (const player of players) {
            // Find the attribute that this player is strongest in
            let strongestAttr = 'skill_level';
            let strongestVal = player.skill_level;
            for (const attr in averages) {
                const currentAttr = attr;
                if (player[currentAttr] > strongestVal) {
                    strongestAttr = currentAttr;
                    strongestVal = player[currentAttr];
                }
            }
            // Find the team that is furthest below the average in this attribute and has fewer than 4 players
            let bestTeamIndex = -1;
            let bestTeamScore = Infinity;
            for (let i = 0; i < numTeams; i++) {
                const score = teamScore(teams[i], strongestAttr);
                if (teams[i].length < 4 && score < bestTeamScore) {
                    bestTeamIndex = i;
                    bestTeamScore = score;
                }
            }
            if (bestTeamIndex >= 0) {
                teams[bestTeamIndex].push(player);
            }
            else {
                // Handle any remaining players here
                console.log('No suitable team found for player', player.username);
            }
        }
        return teams;
    }
    distributePlayersTier(players) {
        const numTeams = players.length === 12 ? 3 : 2;
        const teams = Array.from({ length: numTeams }, () => []);
        // Function to calculate a team's total ranking
        const teamTotalRanking = (team) => team.reduce((total, player) => total + this.computeTotalRanking(player), 0);
        // Distribute players to the teams to balance total ranking
        for (const player of players) {
            // Find the team with the lowest total ranking
            let lowestTeamIndex = 0;
            let lowestTeamRanking = teamTotalRanking(teams[0]);
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
    saveTeamsToDB(teams) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Convert the teams object to a JSON string
                const teamsJSON = JSON.stringify(teams);
                // Insert the JSON string into the game_teams table
                yield userModel_1.default.query(`INSERT INTO game_teams (teams) VALUES ($1)`, [
                    teamsJSON,
                ]);
            }
            catch (err) {
                throw err;
            }
        });
    }
    getAllPlayersRankingsFromUser(username) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT   
          pr.rated_username AS username, 
          AVG(pr.skill_level) AS skill_level,
          AVG(pr.scoring_ability) AS scoring_ability, 
          AVG(pr.defensive_skills) AS defensive_skills,
          AVG(pr.speed_and_agility) AS speed_and_agility, 
          AVG(pr.shooting_range) AS shooting_range,
          AVG(pr.rebound_skills) AS rebound_skills
        FROM player_rankings pr
        WHERE pr.rater_username = $1
        GROUP BY pr.rated_username`, [username]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error(`Failed to fetch player rankings from rater '${username}'`);
            }
        });
    }
    getAllPlayersRankings() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT   
          pr.rated_username AS username, 
          AVG(pr.skill_level) AS skill_level,
          AVG(pr.scoring_ability) AS scoring_ability, 
          AVG(pr.defensive_skills) AS defensive_skills,
          AVG(pr.speed_and_agility) AS speed_and_agility, 
          AVG(pr.shooting_range) AS shooting_range,
          AVG(pr.rebound_skills) AS rebound_skills
        FROM player_rankings pr
        GROUP BY pr.rated_username`);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch player rankings from all raters');
            }
        });
    }
}
const balancedTeamsService = new BalancedTeamsService();
exports.default = balancedTeamsService;

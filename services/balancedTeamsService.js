//server\services\balancedTeamsService.js
const pool = require("../models/userModel");

const setBalancedTeams = async (io, isTierMethod) => {
  try {
    // Fetch all players and their rankings
    const result = await pool.query(
      `SELECT   
      n.username, 
      AVG(pr.skill_level) as skill_level,
      AVG(pr.scoring_ability) as scoring_ability, 
      AVG(pr.defensive_skills) as defensive_skills,
      AVG(pr.speed_and_agility) as speed_and_agility, 
      AVG(pr.shooting_range) as shooting_range,
      AVG(pr.rebound_skills) as rebound_skills
FROM next_game_enlistment n
LEFT JOIN player_rankings pr ON n.username = pr.rated_username
WHERE pr.rater_username IN ('doron')
GROUP BY n.username
  `
    );
    const players = result.rows;

    // Filter out players with null parameters
    const validPlayers = players.filter(
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
      (a, b) => computeTotalRanking(b) - computeTotalRanking(a)
    );

    // Take the first 12 players
    const top12Players = validPlayers.slice(0, 12);

    const distributedTeams = !isTierMethod
      ? distributePlayers(top12Players)
      : distributePlayersTier(top12Players);
    // Distribute the valid players to the teams
    await saveTeamsToDB(distributedTeams);
    io.emit("teamsUpdated");

    return distributedTeams;
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch teams");
  }
};

function computeTotalRanking(player) {
  return (
    Number(player.skill_level) +
    Number(player.scoring_ability) +
    Number(player.defensive_skills) +
    Number(player.speed_and_agility) +
    Number(player.shooting_range) +
    Number(player.rebound_skills)
  );
}

function distributePlayers(players) {
  const numTeams = players.length === 12 ? 3 : 2; // If there are 12 players, create 3 teams; otherwise, create 2 teams
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
      averages[attr] += Number(player[attr]);
    }
  }
  for (const attr in averages) {
    averages[attr] /= players.length;
  }

  // Function to calculate a team's total score in an attribute
  const teamScore = (team, attr) =>
    team.reduce((score, player) => score + Number(player[attr]), 0);

  // Distribute players to the teams that most need them
  for (const player of players) {
    // Find the attribute that this player is strongest in
    let strongestAttr = "skill_level";
    let strongestVal = player.skill_level;
    for (const attr in averages) {
      if (player[attr] > strongestVal) {
        strongestAttr = attr;
        strongestVal = player[attr];
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
    } else {
      // Handle any remaining players here
      console.log("No suitable team found for player", player.username);
    }
  }

  return teams;
}

function distributePlayersTier(players) {
  const numTeams = players.length === 12 ? 3 : 2; // If there are 12 players, create 3 teams; otherwise, create 2 teams
  const teams = Array.from({ length: numTeams }, () => []);

  // Function to calculate a team's total ranking
  const teamTotalRanking = (team) =>
    team.reduce((total, player) => total + computeTotalRanking(player), 0);

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

module.exports = {
  setBalancedTeams,
};

const saveTeamsToDB = async (teams) => {
  try {
    // Convert the teams object to a JSON string
    const teamsJSON = JSON.stringify(teams);

    // Insert the JSON string into the game_teams table
    await pool.query(`INSERT INTO game_teams (teams) VALUES ($1)`, [teamsJSON]);
  } catch (err) {
    throw err;
  }
};

// balancedTeamsService.js

const getAllPlayersRankingsFromUser = async (username) => {
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
    return result.rows;
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to fetch player rankings from rater '${username}'`);
  }
};
const getAllPlayersRankings = async () => {
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
    return result.rows;
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch player rankings from all raters");
  }
};

module.exports = {
  getAllPlayersRankingsFromUser,
  getAllPlayersRankings,
  setBalancedTeams,
};

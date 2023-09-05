//server\services\userService.js:

const pool = require("../models/userModel");

const createUser = async (username, password, email) => {
  try {
    const result = await pool.query(
      "INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING *",
      [username, password, email]
    );
    return result.rows[0];
  } catch (err) {
    console.error(err);
    throw new Error("Failed to create user");
  }
};
const loginUser = async (username, password) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    const user = result.rows[0];

    if (user && user.password === password) {
      // NOTE: in real applications, you should hash the password and compare hashed values.
      return user;
    } else {
      return null;
    }
  } catch (err) {
    console.error(err);
    throw new Error("Failed to authenticate user");
  }
};

const getAllUsernames = async () => {
  try {
    const result = await pool.query("SELECT username FROM users ORDER BY username ASC");
    return result.rows;
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch usernames");
  }
};
const storePlayerRankings = async (rater_username, rankings) => {
  try {
    await pool.query("DELETE FROM player_rankings WHERE rater_username = $1", [
      rater_username,
    ]);

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
        "INSERT INTO player_rankings (rater_username, rated_username, skill_level, scoring_ability, defensive_skills, speed_and_agility, shooting_range, rebound_skills) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
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
  } catch (err) {
    console.error(err);
    throw new Error("Failed to store player rankings");
  }
};

const getPlayerRankings = async (username) => {
  try {
    const result = await pool.query(
      "SELECT * FROM player_rankings WHERE rater_username = $1",
      [username]
    );
    return result.rows;
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch player rankings");
  }
};

const getPlayerRankingsByRater = async (rater_username) => {
  try {
    const result = await pool.query(
      `SELECT u.username, pr.skill_level, pr.scoring_ability, pr.defensive_skills, pr.speed_and_agility, pr.shooting_range, pr.rebound_skills
       FROM users u
       LEFT JOIN player_rankings pr ON u.username = pr.rated_username AND pr.rater_username = $1`,
      [rater_username]
    );
    return result.rows;
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch player rankings");
  }
};

const getAllEnlistedUsers = async () => {
  try {
    const result = await pool.query(
      "SELECT username FROM next_game_enlistment  "
    );
    return result.rows.map((row) => row.username); // Return an array of usernames
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch enlisted users");
  }
};
const deleteEnlistedUsers = async (usernames) => {
  try {
    await pool.query(
      "DELETE FROM next_game_enlistment WHERE username = ANY($1::text[])",
      [usernames]
    );
  } catch (err) {
    console.error(err);
    throw new Error("Failed to delete enlisted users");
  }
};
const enlistUsersBox = async (usernames) => {
  try {
    for (const username of usernames) {
      await pool.query(
        "INSERT INTO next_game_enlistment (username) VALUES ($1)",
        [username]
      );
    }
    return true; // Return true if all inserts were successful
  } catch (err) {
    console.error(err);
    throw new Error("Failed to enlist users for next game");
  }
};
const getTeams = async () => {
  try {
    // Fetch the last row by ordering by game_id in descending order and limiting the result to one row
    const result = await pool.query(
      "SELECT teams FROM game_teams ORDER BY game_id DESC LIMIT 1"
    );

    if (result.rows.length > 0) {
      return result.rows[0].teams; // Return the teams field from the last row
    } else {
      throw new Error("No teams found");
    }
  } catch (err) {
    console.error(err);
    throw err; // Propagate the error to be handled by the caller
  }
};
module.exports = {
  createUser,
  loginUser,
  getAllUsernames,
  storePlayerRankings,
  getPlayerRankings,
  getPlayerRankingsByRater,
  getAllEnlistedUsers,
  deleteEnlistedUsers,
  enlistUsersBox,
  getTeams,
};

//server\controllers\userController.js:

const express = require("express");
const router = express.Router();
const userService = require("../services/userService");
const balancedTeamsService = require("../services/balancedTeamsService");
const { getIo } = require("../socket");
const { verifyToken } = require("./verifyToken");
const jwt = require("jsonwebtoken");

router.get("/", async (req, res) => {
  res.send("2000");
});

router.post("/register", async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const user = await userService.createUser(username, password, email);
    res.status(201).json({ success: true, user: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("\n\n\n login request from1", username, "\n\n\n ");

  try {
    const user = await userService.loginUser(username, password);

    if (user) {
      const token = jwt.sign(
        { username: user.username, userEmail: user.email },
        "Avinoamyakar", // Replace 'yourSecretKey' with a real secret key
        { expiresIn: "20h" } // Token expires in 1 hour
      );
      console.log("\n\n\n token", token, "\n\n\n ");

      res.status(200).json({ success: true, user, token });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/usernames", async (req, res) => {
  try {
    const usernames = await userService.getAllUsernames();

    res
      .status(200)
      .json({ success: true, usernames: usernames.map((u) => u.username) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/rankings", async (req, res) => {
  const { rater_username, rankings } = req.body;
  console.log("Received request body:", JSON.stringify(req.body, null, 2));

  // Log each element and its types
  rankings.forEach((player, index) => {
    console.log(`Player ${index + 1}: ${player.username}`);
    Object.keys(player).forEach((key) => {
      console.log(
        ` - ${key}: value = ${player[key]}, type = ${typeof player[key]}`
      );
    });
  });
  try {
    // Filter out the rankings where not all properties (except username) are numbers between 1 and 10
    const validRankings = rankings.filter((player) => {
      const attributes = Object.keys(player).filter(
        (key) => key !== "username"
      );

      const allValid = attributes.every((key) => {
        const isValid =
          typeof player[key] === "number" &&
          !isNaN(player[key]) &&
          player[key] >= 1 &&
          player[key] <= 10;

        // If not valid, log the reason
        if (!isValid) {
          console.log(
            `Player ${player.username} left out due to invalid value for ${key}: ${player[key]}. ` +
              `Expected type: number between 1 and 10, ` +
              `but got type: ${typeof player[key]} with value: ${player[key]}`
          );
        }

        return isValid;
      });

      return allValid;
    });

    await userService.storePlayerRankings(rater_username, validRankings);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/all-rankings/:rater_username", async (req, res) => {
  const { rater_username } = req.params;
  try {
    const rankings = await userService.getPlayerRankingsByRater(rater_username);
    res.status(200).json({ success: true, rankings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/rankings/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const rankings = await userService.getPlayerRankings(username);

    res.status(200).json({ success: true, rankings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/set-teams", async (req, res) => {
  try {
    const { isTierMethod } = req.body; //!
    const teams = await balancedTeamsService.setBalancedTeams(
      getIo(),
      isTierMethod
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/enlist", async (req, res) => {
  try {
    const usernames = await userService.getAllEnlistedUsers();

    res.status(200).json({ success: true, usernames });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/delete-enlist", async (req, res) => {
  try {
    const { usernames, isTierMethod } = req.body; //!
    await userService.deleteEnlistedUsers(usernames);
    await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/enlist-users", verifyToken, async (req, res) => {
  try {
    console.log("\n\n\n enlist-users", "enlist-users", "\n\n\n ");

    const { usernames, isTierMethod } = req.body; //!

    await userService.enlistUsersBox(usernames);
    await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod); // Pass method to function//!

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/get-teams", async (req, res) => {
  try {
    const teams = await userService.getTeams();
    res.status(200).json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// routes.js or your router file

router.get("/players-rankings/:username", async (req, res) => {
  const username = req.params.username;
  try {
    const playersRankings =
      await balancedTeamsService.getAllPlayersRankingsFromUser(username);
    res.status(200).json({ success: true, playersRankings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// routes.js or your router file

router.get("/players-rankings", async (req, res) => {
  try {
    const playersRankings = await balancedTeamsService.getAllPlayersRankings();
    res.status(200).json({ success: true, playersRankings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

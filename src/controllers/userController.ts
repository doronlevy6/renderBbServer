// src/controllers/userController.ts

import express, { Request, Response, Router } from 'express';
import userService from '../services/userService';
import balancedTeamsService from '../services/balancedTeamsService';
import { getIo } from '../socket/socket';
import { verifyToken } from './verifyToken';
import jwt from 'jsonwebtoken';
import teamService from '../services/teamService';

// הגדרת ממשקים (Interfaces) לטיפוסים של הבקשות
interface RegisterRequestBody {
  username: string;
  password: string;
  email: string;
  teamId?: number;
}

interface LoginRequestBody {
  username: string;
  password: string;
}

interface CreateTeamRequestBody {
  team_name: string;
  team_password: string;
  team_type: string;
}

interface Ranking {
  username: string;
  skillLevel: number;
  scoringAbility: number;
  defensiveSkills: number;
  speedAndAgility: number;
  shootingRange: number;
  reboundSkills: number;
  // הוסף שדות נוספים במידת הצורך
}

interface RankingsRequestBody {
  rater_username: string;
  rankings: Ranking[];
}

interface EnlistRequestBody {
  usernames: string[];
  isTierMethod: boolean;
}

interface DeleteEnlistRequestBody {
  usernames: string[];
  isTierMethod: boolean;
}

interface EnlistUsersRequestBody {
  usernames: string[];
  isTierMethod: boolean;
}

const router: Router = express.Router();

router.post(
  '/create-team',
  async (req: Request<{}, {}, CreateTeamRequestBody>, res: Response) => {
    const { team_name, team_password, team_type } = req.body;
    try {
      const team = await teamService.createTeam(
        team_name,
        team_password,
        team_type
      );
      res.status(201).json({ success: true, team });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/register',
  async (req: Request<{}, {}, RegisterRequestBody>, res: Response) => {
    const { username, password, email, teamId } = req.body;
    try {
      const user = await userService.createUser(
        username,
        password,
        email,
        teamId
      );
      res.status(201).json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/login',
  async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
    const { username, password } = req.body;
    try {
      const user = await userService.loginUser(username, password);
      if (user) {
        const token = jwt.sign(
          { username: user.username, userEmail: user.email },
          process.env.JWT_SECRET as string, // השתמש במשתנה סביבה
          { expiresIn: '20h' } // Token expires in 20 hours
        );

        res.status(200).json({ success: true, user, token });
      } else {
        res
          .status(401)
          .json({ success: false, message: 'Invalid credentials' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/usernames', async (req: Request, res: Response) => {
  try {
    const usernames = await userService.getAllUsernames();

    res
      .status(200)
      .json({ success: true, usernames: usernames.map((u) => u.username) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/rankings',
  async (req: Request<{}, {}, RankingsRequestBody>, res: Response) => {
    const { rater_username, rankings } = req.body;
    // לוגיקה להוספת רמות

    try {
      // סינון הדירוגים
      const validRankings = rankings.filter((player) => {
        const attributes = Object.keys(player).filter(
          (key) => key !== 'username'
        );

        const allValid = attributes.every((key) => {
          const value = (player as any)[key];
          const isValid =
            typeof value === 'number' &&
            !isNaN(value) &&
            value >= 1 &&
            value <= 10;

          if (!isValid) {
            console.log(
              `Player ${player.username} left out due to invalid value for ${key}: ${value}. ` +
                `Expected type: number between 1 and 10, ` +
                `but got type: ${typeof value} with value: ${value}`
            );
          }

          return isValid;
        });

        return allValid;
      });

      await userService.storePlayerRankings(rater_username, validRankings);
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/rankings/:username',
  async (req: Request<{ username: string }>, res: Response) => {
    const { username } = req.params;
    try {
      const rankings = await userService.getPlayerRankings(username);

      res.status(200).json({ success: true, rankings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/enlist', async (req: Request, res: Response) => {
  try {
    const usernames = await userService.getAllEnlistedUsers();

    res.status(200).json({ success: true, usernames });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/delete-enlist', async (req: Request, res: Response) => {
  try {
    const { usernames, isTierMethod } = req.body as DeleteEnlistRequestBody;
    await userService.deleteEnlistedUsers(usernames);
    await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod);
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/enlist-users',
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const { usernames, isTierMethod } = req.body as EnlistUsersRequestBody;

      await userService.enlistUsersBox(usernames);
      await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod); // Pass method to function//!

      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/get-teams', async (req: Request, res: Response) => {
  try {
    const teams = await userService.getTeams();
    res.status(200).json({ success: true, teams });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// routes.js or your router file

router.get(
  '/players-rankings/:username',
  async (req: Request<{ username: string }>, res: Response) => {
    const username = req.params.username;
    try {
      const playersRankings =
        await balancedTeamsService.getAllPlayersRankingsFromUser(username);
      res.status(200).json({ success: true, playersRankings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// routes.js or your router file

router.get('/players-rankings', async (req: Request, res: Response) => {
  try {
    const playersRankings = await balancedTeamsService.getAllPlayersRankings();
    res.status(200).json({ success: true, playersRankings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

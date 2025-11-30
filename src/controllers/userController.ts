// src/controllers/userController.ts

import express, { Request, Response, Router } from 'express';
import userService from '../services/userService';
import balancedTeamsService from '../services/balancedTeamsService';
import { getIo } from '../socket/socket';
import { verifyToken } from './verifyToken';
import jwt from 'jsonwebtoken';
import teamService from '../services/teamService';
import { log } from 'console';
import pool from '../models/userModel'; // Import pool for rollback

// הגדרת ממשקים (Interfaces) לטיפוסים של הבקשות
interface RegisterRequestBody {
  username: string;
  password: string;
  email: string;
  teamName: string;
  teamPassword?: string;
  teamType?: string; // Add teamType
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
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  param5: number;
  param6: number;
}

interface RankingsRequestBody {
  rater_username: string;
  rankings: Ranking[];
}

// interface EnlistRequestBody {
//   usernames: string[];
//   isTierMethod: boolean;
// }

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
  async (
    req: Request<{}, any, RegisterRequestBody>,
    res: Response
  ): Promise<void> => {
    const { username, password, email, teamName, teamPassword, teamType } = req.body;
    let teamId: number | undefined; // Declare outside try block

    try {
      // If teamType is provided, we are creating a new team
      if (teamType) {
        // Check if team name already exists
        const existingTeam = await teamService.getTeamByName(teamName);
        if (existingTeam) {
          res.status(400).json({ success: false, message: 'Team name already exists' });
          return;
        }

        if (!teamPassword) {
          res.status(400).json({ success: false, message: 'Team password is required' });
          return;
        }

        // Create the team
        const newTeam = await teamService.createTeam(teamName, teamPassword, teamType);
        teamId = newTeam.team_id;
      } else {
        // Joining an existing team
        const team = await teamService.getTeamByName(teamName);
        if (!team) {
          res.status(400).json({ success: false, message: 'Team not found' });
          return;
        }
        if (team.team_password !== teamPassword) {
          res
            .status(400)
            .json({ success: false, message: 'Invalid team password' });
          return;
        }
        teamId = team.team_id;
      }

      // Check if this is the first user in the team (for role assignment)
      const existingUsers = await userService.getAllUsernames(teamId);
      const role = existingUsers.length === 0 ? 'manager' : 'player';

      const user = await userService.createUser(
        username,
        password,
        email,
        teamId,
        role
      );

      res.status(201).json({ success: true, user });
    } catch (err: any) {
      // Rollback: If we created a new team but user creation failed, delete the team
      if (teamType && teamId) { // Check if teamType was provided and teamId was set
        try {
          console.log(`Rolling back team creation for teamId: ${teamId}`);
          await pool.query('DELETE FROM teams WHERE team_id = $1', [teamId]);
        } catch (rollbackErr) {
          console.error('Failed to rollback team creation', rollbackErr);
        }
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/login',
  async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
    const { username, password } = req.body;
    console.log(username + 'connected');
    try {
      const user = await userService.loginUser(username, password);
      if (user) {
        const token = jwt.sign(
          {
            username: user.username,
            userEmail: user.email,
            team_id: user.team_id,
            role: (user as any).role || 'player',
          },
          process.env.JWT_SECRET as string,
          { expiresIn: '20h' }
        );

        const isAdmin = (user as any).role === 'manager';

        res.status(200).json({ success: true, user, token, is_admin: isAdmin });
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

router.get('/usernames', verifyToken, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const teamid = req.user?.team_id;
    const usernames = await userService.getAllUsernames(teamid!);
    console.log('teamid', teamid);

    res
      .status(200)
      .json({ success: true, usernames: usernames.map((u) => u.username) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/rankings',
  verifyToken, // Add verifyToken middleware
  async (req: Request<{}, {}, RankingsRequestBody>, res: Response) => {
    const { rater_username, rankings } = req.body;
    // @ts-ignore
    const teamId = req.user?.team_id; // Get teamId from token
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

      console.log('rater_username', rater_username);

      await userService.storePlayerRankings(rater_username, validRankings, teamId);
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

// עדכון הנתיב כך שישתמש ב-verifyToken לקבלת team_id מהטוקן
router.get('/enlist', verifyToken, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const teamId = req.user?.team_id || 1;
    const usernames = await userService.getAllEnlistedUsers(teamId);
    res.status(200).json({ success: true, usernames });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post('/delete-enlist', async (req: Request, res: Response) => {
  try {
    const { usernames, isTierMethod } = req.body as DeleteEnlistRequestBody;
    await userService.deleteEnlistedUsers(usernames);
    // await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod);
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
      // @ts-ignore
      const teamId = req.user?.team_id;

      await userService.enlistUsersBox(usernames, teamId);
      // await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod); // Pass method to function//!

      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/teams', async (req: Request, res: Response) => {
  try {
    // נניח שיש לכם מתודה ב-teamService בשם getAllTeams
    const teams = await userService.getAllTeams();
    res.status(200).json({ success: true, teams });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get(
  '/players-rankings/:username',
  verifyToken,
  async (req: Request<{ username: string }>, res: Response) => {
    const username = req.params.username;
    // @ts-ignore
    const teamId = req.user?.team_id || 1;
    try {
      const playersRankings =
        await balancedTeamsService.getAllPlayersRankingsFromUser(
          username,
          teamId
        );
      res.status(200).json({ success: true, playersRankings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// routes.js or your router file

// עדכון הנתיב כך שמעבירים את teamId לשירות:
router.get(
  '/players-rankings',
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      // @ts-ignore
      const teamId = req.user?.team_id || 1;
      const playersRankings = await balancedTeamsService.getAllPlayersRankings(
        teamId
      );
      res.status(200).json({ success: true, playersRankings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// --- Management Endpoints ---

router.get('/players', verifyToken, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const teamId = req.user?.team_id || 1;
    const users = await userService.getAllUsers(teamId);
    res.status(200).json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/add-player', verifyToken, async (req: Request, res: Response) => {
  const { username, password, email, teamId } = req.body;
  try {
    // @ts-ignore
    const requesterTeamId = req.user?.team_id;

    // If teamId is not provided, use the requester's teamId
    const targetTeamId = teamId || requesterTeamId;

    if (!targetTeamId) {
      res.status(400).json({ success: false, message: 'Team ID is required. Please ensure you are logged in and associated with a team.' });
      return;
    }

    const user = await userService.createUser(username, password || '123456', email || '', targetTeamId);
    res.status(201).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/delete-player/:username', verifyToken, async (req: Request, res: Response) => {
  const { username } = req.params;
  try {
    await userService.deleteUser(username);
    res.status(200).json({ success: true, message: 'Player deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update-player/:username', verifyToken, async (req: Request, res: Response) => {
  const { username } = req.params;
  const { newUsername, newEmail, newPassword } = req.body;
  try {
    const user = await userService.updateUser(username, newUsername, newEmail, newPassword);
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update-player-roles', verifyToken, async (req: Request, res: Response) => {
  const { roleUpdates } = req.body as { roleUpdates: Array<{ username: string; role: string }> };

  try {
    // @ts-ignore
    const requesterRole = req.user?.role;

    // Only managers can update roles
    if (requesterRole !== 'manager') {
      res.status(403).json({ success: false, message: 'Only managers can update roles' });
      return;
    }

    // Update each player's role
    for (const update of roleUpdates) {
      await userService.updatePlayerRole(update.username, update.role);
    }

    res.status(200).json({ success: true, message: 'Roles updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

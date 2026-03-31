import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import userService from '../../services/userService';
import teamService from '../../services/teamService';
import pool from '../../models/userModel';

interface RegisterRequestBody {
  username: string;
  password: string;
  email: string;
  teamName: string;
  teamPassword?: string;
  teamType?: string;
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

export function registerAuthRoutes(router: Router): void {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '45d';

  // Team creation functionality (used by registration flow).
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

  // User registration functionality (new team creation or join existing team).
  router.post(
    '/register',
    async (
      req: Request<{}, any, RegisterRequestBody>,
      res: Response
    ): Promise<void> => {
      const { username, password, email, teamName, teamPassword, teamType } =
        req.body;
      let teamId: number | undefined;

      try {
        if (teamType) {
          const existingTeam = await teamService.getTeamByName(teamName);
          if (existingTeam) {
            res
              .status(400)
              .json({ success: false, message: 'Team name already exists' });
            return;
          }

          if (!teamPassword) {
            res
              .status(400)
              .json({
                success: false,
                message: 'Team password is required',
              });
            return;
          }

          const newTeam = await teamService.createTeam(
            teamName,
            teamPassword,
            teamType
          );
          teamId = newTeam.team_id;
        } else {
          const team = await teamService.getTeamByName(teamName);
          if (!team) {
            res
              .status(400)
              .json({ success: false, message: 'Team not found' });
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
        // Rollback team when registration fails after team creation.
        if (teamType && teamId) {
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

  // User login functionality (JWT + role flags).
  router.post(
    '/login',
    async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
      const { username, password } = req.body;
      console.log(username + 'connected');

      if (!jwtSecret) {
        res
          .status(500)
          .json({ success: false, message: 'Server JWT is not configured' });
        return;
      }

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
            jwtSecret,
            { expiresIn: jwtExpiresIn }
          );

          const isAdmin = (user as any).role === 'manager';

          res
            .status(200)
            .json({
              success: true,
              user,
              token,
              is_admin: isAdmin,
              token_expires_in: jwtExpiresIn,
            });
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
}

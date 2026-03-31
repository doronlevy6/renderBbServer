import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import userService from '../../services/userService';
import teamService from '../../services/teamService';
import pool from '../../models/userModel';
import sessionTokenService from '../../services/sessionTokenService';

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

interface RefreshTokenRequestBody {
  refresh_token?: string;
}

interface LogoutRequestBody {
  refresh_token?: string;
}

interface CreateTeamRequestBody {
  team_name: string;
  team_password: string;
  team_type: string;
}

interface AccessTokenPayload {
  username: string;
  userEmail: string;
  team_id: number;
  role: string;
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || null;
}

function buildAccessToken(
  payload: AccessTokenPayload,
  jwtSecret: string,
  jwtExpiresIn: string
): string {
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
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
          const teamId = (user as any).team_id;
          if (!teamId) {
            res
              .status(400)
              .json({ success: false, message: 'User is not linked to a team' });
            return;
          }

          const role = (user as any).role || 'player';
          const token = buildAccessToken(
            {
              username: user.username,
              userEmail: user.email,
              team_id: teamId,
              role,
            },
            jwtSecret,
            jwtExpiresIn
          );

          const refreshTokenSession = await sessionTokenService.issueRefreshToken(
            {
              username: user.username,
              teamId,
              userAgent: req.get('user-agent') || null,
              ipAddress: getClientIp(req),
            }
          );

          const isAdmin = role === 'manager';

          res
            .status(200)
            .json({
              success: true,
              user,
              token,
              refresh_token: refreshTokenSession.refreshToken,
              is_admin: isAdmin,
              token_expires_in: jwtExpiresIn,
              refresh_token_expires_in: refreshTokenSession.refreshTokenExpiresIn,
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

  // Refresh access token with refresh token rotation.
  router.post(
    '/refresh-token',
    async (req: Request<{}, {}, RefreshTokenRequestBody>, res: Response) => {
      if (!jwtSecret) {
        res
          .status(500)
          .json({ success: false, message: 'Server JWT is not configured' });
        return;
      }

      const refreshToken = req.body?.refresh_token;
      if (!refreshToken) {
        res
          .status(400)
          .json({ success: false, message: 'Refresh token is required' });
        return;
      }

      try {
        const rotated = await sessionTokenService.rotateRefreshToken(
          refreshToken,
          {
            userAgent: req.get('user-agent') || null,
            ipAddress: getClientIp(req),
          }
        );

        if (!rotated) {
          res
            .status(401)
            .json({ success: false, message: 'Refresh token is invalid or expired' });
          return;
        }

        const role = rotated.user.role || 'player';
        const accessToken = buildAccessToken(
          {
            username: rotated.user.username,
            userEmail: rotated.user.email,
            team_id: rotated.user.team_id,
            role,
          },
          jwtSecret,
          jwtExpiresIn
        );

        res.status(200).json({
          success: true,
          token: accessToken,
          refresh_token: rotated.refreshToken,
          token_expires_in: jwtExpiresIn,
          refresh_token_expires_in: rotated.refreshTokenExpiresIn,
          is_admin: role === 'manager',
          user: {
            username: rotated.user.username,
            email: rotated.user.email,
            team_id: rotated.user.team_id,
            role,
            team_type: rotated.user.team_type,
          },
        });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );

  // Revoke refresh token on logout.
  router.post(
    '/logout',
    async (req: Request<{}, {}, LogoutRequestBody>, res: Response) => {
      const refreshToken = req.body?.refresh_token;

      if (!refreshToken) {
        res.status(200).json({
          success: true,
          message: 'Logged out locally (no refresh token provided)',
        });
        return;
      }

      try {
        await sessionTokenService.revokeRefreshToken(refreshToken);
        res.status(200).json({ success: true, message: 'Logged out successfully' });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );
}

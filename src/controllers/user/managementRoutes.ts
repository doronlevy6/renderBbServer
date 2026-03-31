import { Request, Response, Router } from 'express';
import userService from '../../services/userService';
import { verifyToken } from '../verifyToken';
import { requireManager } from '../authz';

export function registerManagementRoutes(router: Router): void {
  // Public list of teams for registration/login flows.
  router.get('/teams', async (_req: Request, res: Response) => {
    try {
      const teams = await userService.getAllTeams();
      res.status(200).json({ success: true, teams });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Manager view: list all players in the requester's team.
  router.get('/players', verifyToken, requireManager, async (req: Request, res: Response) => {
    try {
      // @ts-ignore
      const teamId = req.user?.team_id || 1;
      const users = await userService.getAllUsers(teamId);
      res.status(200).json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Manager action: add a new player into requester's team.
  router.post('/add-player', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { username, password, email } = req.body as {
      username?: string;
      password?: string;
      email?: string;
    };
    try {
      // @ts-ignore
      const requesterTeamId = req.user?.team_id;
      // @ts-ignore
      const requesterRole = req.user?.role;
      const cleanUsername = username?.trim();
      const cleanEmail = email?.trim() || '';
      const cleanPassword = password?.trim() || '123456';

      if (requesterRole !== 'manager') {
        res
          .status(403)
          .json({
            success: false,
            message: 'Only managers can add players',
          });
        return;
      }

      if (!cleanUsername) {
        res.status(400).json({ success: false, message: 'Username is required' });
        return;
      }

      if (!requesterTeamId) {
        res.status(400).json({
          success: false,
          message:
            'Team ID is required. Please ensure you are logged in and associated with a team.',
        });
        return;
      }

      const user = await userService.createUser(
        cleanUsername,
        cleanPassword,
        cleanEmail,
        requesterTeamId,
        'player'
      );
      res.status(201).json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Manager action: delete player by username.
  router.delete(
    '/delete-player/:username',
    verifyToken,
    requireManager,
    async (req: Request, res: Response) => {
      const { username } = req.params;
      // @ts-ignore
      const requesterTeamId = req.user?.team_id;
      try {
        if (!requesterTeamId) {
          res.status(400).json({ success: false, message: 'Team identification failed' });
          return;
        }
        await userService.deleteUser(username, requesterTeamId);
        res
          .status(200)
          .json({ success: true, message: 'Player deleted successfully' });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );

  // Manager action: update player identity fields and optional password.
  router.put(
    '/update-player/:username',
    verifyToken,
    requireManager,
    async (req: Request, res: Response) => {
      const { username } = req.params;
      const { newUsername, newEmail, newPassword } = req.body;
      // @ts-ignore
      const requesterTeamId = req.user?.team_id;
      try {
        if (!requesterTeamId) {
          res.status(400).json({ success: false, message: 'Team identification failed' });
          return;
        }
        const user = await userService.updateUser(
          username,
          newUsername,
          newEmail,
          newPassword,
          requesterTeamId
        );
        res.status(200).json({ success: true, user });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );

  // Manager action: bulk role updates.
  router.put(
    '/update-player-roles',
    verifyToken,
    requireManager,
    async (req: Request, res: Response) => {
      const { roleUpdates } = req.body as {
        roleUpdates: Array<{ username: string; role: string }>;
      };

      try {
        // @ts-ignore
        const requesterRole = req.user?.role;
        // @ts-ignore
        const requesterTeamId = req.user?.team_id;

        if (requesterRole !== 'manager') {
          res.status(403).json({
            success: false,
            message: 'Only managers can update roles',
          });
          return;
        }

        if (!requesterTeamId) {
          res.status(400).json({ success: false, message: 'Team identification failed' });
          return;
        }

        for (const update of roleUpdates) {
          await userService.updatePlayerRole(
            update.username,
            update.role,
            requesterTeamId
          );
        }

        res
          .status(200)
          .json({ success: true, message: 'Roles updated successfully' });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );
}

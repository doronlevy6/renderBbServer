import { Request, Response, Router } from 'express';
import userService from '../../services/userService';
import { verifyToken } from '../verifyToken';
import { requireManager } from '../authz';

interface DeleteEnlistRequestBody {
  usernames: string[];
  isTierMethod: boolean;
}

interface EnlistUsersRequestBody {
  usernames: string[];
  isTierMethod: boolean;
}

export function registerEnlistRoutes(router: Router): void {
  // Team usernames list for authenticated user team.
  router.get('/usernames', verifyToken, async (req: Request, res: Response) => {
    try {
      // @ts-ignore
      const teamid = req.user?.team_id;
      const users = await userService.getAllUsernames(teamid!);
      console.log('teamid', teamid);

      res
        .status(200)
        .json({
          success: true,
          usernames: users.map((u) => u.username),
          users: users.map((u) => ({
            username: u.username,
            role: (u.role || 'player').toLowerCase(),
          })),
        });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Return currently enlisted players for authenticated team.
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

  // Remove players from enlist list (manager-only).
  router.post('/delete-enlist', verifyToken, requireManager, async (req: Request, res: Response) => {
    try {
      const { usernames } = req.body as DeleteEnlistRequestBody;
      await userService.deleteEnlistedUsers(usernames);
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Add players to enlist list for authenticated team.
  router.post(
    '/enlist-users',
    verifyToken,
    requireManager,
    async (req: Request, res: Response) => {
      try {
        const { usernames } = req.body as EnlistUsersRequestBody;
        // @ts-ignore
        const teamId = req.user?.team_id;

        await userService.enlistUsersBox(usernames, teamId);
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );
}

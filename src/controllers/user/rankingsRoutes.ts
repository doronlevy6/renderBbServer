import { Request, Response, Router } from 'express';
import userService from '../../services/userService';
import balancedTeamsService from '../../services/balancedTeamsService';
import { verifyToken } from '../verifyToken';
import { getUsername, isManager } from '../authz';

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

export function registerRankingRoutes(router: Router): void {
  // Save a player's rankings submission for the authenticated team.
  router.post(
    '/rankings',
    verifyToken,
    async (req: Request<{}, {}, RankingsRequestBody>, res: Response) => {
      const { rater_username, rankings } = req.body;
      // @ts-ignore
      const teamId = req.user?.team_id;

      try {
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

        await userService.storePlayerRankings(
          rater_username,
          validRankings,
          teamId
        );
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );

  // Fetch rankings submitted by a specific user.
  router.get(
    '/rankings/:username',
    verifyToken,
    async (req: Request<{ username: string }>, res: Response) => {
      const { username } = req.params;
      const requester = getUsername(req);
      const manager = isManager(req);
      if (!requester) {
        res.status(400).json({ success: false, message: 'Missing requester identity' });
        return;
      }
      if (!manager && requester !== username) {
        res.status(403).json({ success: false, message: 'Not authorized to view this ranking' });
        return;
      }
      try {
        const rankings = await userService.getPlayerRankings(username);
        res.status(200).json({ success: true, rankings });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  );

  // Fetch all rankings from a specific user, enriched for balancing flows.
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

  // Fetch the aggregate rankings list for the authenticated team.
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
}

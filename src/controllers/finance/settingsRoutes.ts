import { Request, Response, Router } from 'express';
import pool from '../../models/userModel';
import { verifyToken } from '../verifyToken';
import { getTeamId, requireManager } from '../authz';

export function registerFinanceSettingsRoutes(router: Router): void {
  // New endpoint to just get settings for team (for settings page)
  router.get('/team-settings', verifyToken, requireManager, async (req: Request, res: Response) => {
    const team_id = getTeamId(req);
    if (!team_id) {
      res.status(400).json({ success: false, message: 'No team id' });
      return;
    }

    try {
      const teamRes = await pool.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
      const defaultCost = teamRes.rows[0]?.default_game_cost || 0;
      res.status(200).json({ success: true, defaultGameCost: defaultCost });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.put('/update-team-settings', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { default_game_cost } = req.body;
    const team_id = getTeamId(req);

    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    try {
      await pool.query('UPDATE teams SET default_game_cost = $1 WHERE team_id = $2', [default_game_cost, team_id]);
      res.status(200).json({ success: true, message: 'Team settings updated' });
    } catch (error: any) {
      console.error('Error updating team settings:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.put('/update-user-financial-settings', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { username, custom_game_cost } = req.body;
    const team_id = getTeamId(req);
    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }
    try {
      const updateRes = await pool.query(
        'UPDATE users SET custom_game_cost = $1 WHERE username = $2 AND team_id = $3',
        [custom_game_cost, username, team_id]
      );
      if (updateRes.rowCount === 0) {
        res.status(404).json({ success: false, message: 'Player not found in team' });
        return;
      }
      res.status(200).json({ success: true, message: 'User settings updated' });
    } catch (error: any) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
}

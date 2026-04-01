import { Request, Response, Router } from 'express';
import pool from '../../models/userModel';
import { verifyToken } from '../verifyToken';
import { getTeamId, getUsername, isManager, requireManager } from '../authz';

export function registerFinanceReportRoutes(router: Router): void {
  // Financial details: manager can read any team member, player can read only self.
  router.get('/player-financials/:username', verifyToken, async (req: Request, res: Response) => {
    const { username } = req.params;
    const team_id = getTeamId(req);
    const requester = getUsername(req);
    const manager = isManager(req);

    if (!team_id || !requester) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }
    if (!manager && requester !== username) {
      res.status(403).json({ success: false, message: 'Not authorized to view this player' });
      return;
    }

    try {
      // 1. Get Games Attended
      const attendanceQuery = `
            SELECT ga.attendance_id, ga.applied_cost, ga.adjustment_note, g.date, g.game_id, g.notes
            FROM game_attendance ga
            JOIN games g ON ga.game_id = g.game_id
            WHERE ga.username = $1 AND g.team_id = $2
            ORDER BY g.date DESC
        `;
      const attendanceRes = await pool.query(attendanceQuery, [username, team_id]);

      // 2. Get Payments Made
      const paymentsQuery = `
            SELECT payment_id, amount, method, date, notes
            FROM payments
            WHERE username = $1 AND team_id = $2
            ORDER BY date DESC
        `;
      const paymentsRes = await pool.query(paymentsQuery, [username, team_id]);

      // 3. Calculate Balance
      const totalCost = attendanceRes.rows.reduce((sum: number, record: any) => sum + record.applied_cost, 0);
      const totalPaid = paymentsRes.rows.reduce((sum: number, record: any) => sum + record.amount, 0);
      const balance = totalPaid - totalCost; // Positive = Credit, Negative = Debt

      // 4. Get User Settings (Custom Cost)
      const userRes = await pool.query(
        'SELECT custom_game_cost FROM users WHERE username = $1 AND team_id = $2',
        [username, team_id]
      );
      const customCost = userRes.rows[0]?.custom_game_cost || null;

      res.status(200).json({
        success: true,
        balance,
        totalCost,
        totalPaid,
        customGameCost: customCost,
        history: {
          games: attendanceRes.rows,
          payments: paymentsRes.rows
        }
      });
    } catch (error: any) {
      console.error('Error fetching player financials:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Lightweight endpoint for player balance (for Welcome Page)
  router.get('/player-balance/:username', verifyToken, async (req: Request, res: Response) => {
    const { username } = req.params;
    const team_id = getTeamId(req);
    const requester = getUsername(req);
    const manager = isManager(req);

    if (!team_id || !requester) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }
    if (!manager && requester !== username) {
      res.status(403).json({ success: false, message: 'Not authorized to view this player' });
      return;
    }

    try {
      // 1. Get total game costs
      const costQuery = `
            SELECT COALESCE(SUM(ga.applied_cost), 0) as total_owed
            FROM game_attendance ga
            JOIN games g ON ga.game_id = g.game_id
            WHERE ga.username = $1 AND g.team_id = $2
        `;
      const costRes = await pool.query(costQuery, [username, team_id]);
      const totalOwed = parseInt(costRes.rows[0].total_owed);

      // 2. Get total payments
      const payQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_paid
            FROM payments
            WHERE username = $1 AND team_id = $2
        `;
      const payRes = await pool.query(payQuery, [username, team_id]);
      const totalPaid = parseInt(payRes.rows[0].total_paid);

      // 3. Get player's cost per game
      const userRes = await pool.query(
        'SELECT custom_game_cost FROM users WHERE username = $1 AND team_id = $2',
        [username, team_id]
      );
      const customCost = userRes.rows[0]?.custom_game_cost;

      // If no custom cost, get team default
      let costPerGame = customCost;
      if (customCost === null) {
        const teamRes = await pool.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
        costPerGame = teamRes.rows[0]?.default_game_cost || 30;
      }

      // 4. Calculate balance and games credit
      const balance = totalPaid - totalOwed; // Positive = Credit, Negative = Debt
      const gamesCredit = costPerGame > 0 ? Math.floor(balance / costPerGame) : 0;

      res.status(200).json({
        success: true,
        totalPaid,
        totalOwed,
        balance,
        costPerGame,
        gamesCredit
      });
    } catch (error: any) {
      console.error('Error fetching player balance:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Team financial summary is manager-only.
  router.get('/team-financial-summary/:team_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const requestedTeamId = Number(req.params.team_id);
    const team_id = getTeamId(req);
    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }
    if (requestedTeamId && requestedTeamId !== team_id) {
      res.status(403).json({ success: false, message: 'Not authorized for this team' });
      return;
    }

    try {
      const usersRes = await pool.query(
        'SELECT username, custom_game_cost, role FROM users WHERE team_id = $1',
        [team_id]
      );
      const users = usersRes.rows;

      const summary = [];

      for (const user of users) {
        const debtRes = await pool.query(
          `
                SELECT COALESCE(SUM(applied_cost), 0) as debt 
                FROM game_attendance ga
                JOIN games g ON ga.game_id = g.game_id
                WHERE ga.username = $1 AND g.team_id = $2
             `,
          [user.username, team_id]
        );

        const paidRes = await pool.query(
          `
                SELECT COALESCE(SUM(amount), 0) as paid 
                FROM payments 
                WHERE username = $1 AND team_id = $2
             `,
          [user.username, team_id]
        );
        const lastPaymentRes = await pool.query(
          `
                SELECT amount, date
                FROM payments
                WHERE username = $1 AND team_id = $2
                ORDER BY date DESC, payment_id DESC
                LIMIT 1
             `,
          [user.username, team_id]
        );

        const debt = parseInt(debtRes.rows[0].debt);
        const paid = parseInt(paidRes.rows[0].paid);
        const lastPayment = lastPaymentRes.rows[0];

        summary.push({
          username: user.username,
          role: user.role || 'player',
          balance: paid - debt,
          debt,
          paid,
          last_payment_amount:
            lastPayment?.amount == null ? null : parseInt(lastPayment.amount),
          last_payment_date: lastPayment?.date || null,
          custom_game_cost: user.custom_game_cost
        });
      }

      const teamRes = await pool.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
      const defaultCost = teamRes.rows[0]?.default_game_cost || 0;

      res.status(200).json({ success: true, summary, defaultGameCost: defaultCost });
    } catch (error: any) {
      console.error('Error fetching team summary:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Full team financial history is manager-only.
  router.get('/all-players-history/:team_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const requestedTeamId = Number(req.params.team_id);
    const team_id = getTeamId(req);
    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }
    if (requestedTeamId && requestedTeamId !== team_id) {
      res.status(403).json({ success: false, message: 'Not authorized for this team' });
      return;
    }

    try {
      const usersRes = await pool.query(
        'SELECT username, custom_game_cost, role FROM users WHERE team_id = $1',
        [team_id]
      );
      const users = usersRes.rows;

      const allData: Record<string, any> = {};

      // Parallelize the data fetching for all users
      await Promise.all(users.map(async (user: any) => {
        const username = user.username;

        // 1. Get Games Attended
        const attendanceQuery = `
                SELECT ga.attendance_id, ga.applied_cost, ga.adjustment_note, g.date, g.game_id, g.notes
                FROM game_attendance ga
                JOIN games g ON ga.game_id = g.game_id
                WHERE ga.username = $1 AND g.team_id = $2
                ORDER BY g.date DESC
            `;
        const attendanceRes = await pool.query(attendanceQuery, [username, team_id]);

        // 2. Get Payments Made
        const paymentsQuery = `
                SELECT payment_id, amount, method, date, notes
                FROM payments
                WHERE username = $1 AND team_id = $2
                ORDER BY date DESC
            `;
        const paymentsRes = await pool.query(paymentsQuery, [username, team_id]);

        // 3. Calculate Balance
        const totalCost = attendanceRes.rows.reduce((sum: number, record: any) => sum + record.applied_cost, 0);
        const totalPaid = paymentsRes.rows.reduce((sum: number, record: any) => sum + record.amount, 0);
        const balance = totalPaid - totalCost;

        allData[username] = {
          success: true,
          role: user.role || 'player',
          balance,
          totalCost,
          totalPaid,
          customGameCost: user.custom_game_cost,
          history: {
            games: attendanceRes.rows,
            payments: paymentsRes.rows
          }
        };
      }));

      res.status(200).json({ success: true, allPlayersData: allData });
    } catch (error: any) {
      console.error('Error fetching all players history:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
}

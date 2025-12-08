
import express, { Request, Response, Router } from 'express';
import pool from '../models/userModel';
import { verifyToken } from './verifyToken';

const router: Router = express.Router();

// ==========================================
// GAME MANAGEMENT
// ==========================================

router.post('/record-game', verifyToken, async (req: Request, res: Response) => {
    const { date, enlistedPlayers, base_cost, notes } = req.body;
    // @ts-ignore
    const team_id = req.user?.team_id;

    if (!team_id) {
        res.status(400).json({ success: false, message: 'Team identification failed' });
        return;
    }

    try {
        // 1. Get Team Default Cost if not provided
        let costPerGame = base_cost;
        if (costPerGame === undefined) {
            const teamRes = await pool.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
            if (teamRes.rows.length === 0) {
                res.status(404).json({ success: false, message: 'Team not found' });
                return;
            }
            costPerGame = teamRes.rows[0].default_game_cost || 0;
        }

        // 2. Create Game Record
        const gameQuery = `
      INSERT INTO games (team_id, date, base_cost, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING game_id
    `;
        const gameValues = [team_id, date || new Date(), costPerGame, notes || ''];
        const gameResult = await pool.query(gameQuery, gameValues);
        const gameId = gameResult.rows[0].game_id;

        // 3. Create Attendance Records
        if (enlistedPlayers && enlistedPlayers.length > 0) {
            for (const username of enlistedPlayers) {
                // Check for player-specific cost override
                const userRes = await pool.query('SELECT custom_game_cost FROM users WHERE username = $1', [username]);
                let playerCost = costPerGame;
                if (userRes.rows.length > 0 && userRes.rows[0].custom_game_cost !== null) {
                    playerCost = userRes.rows[0].custom_game_cost;
                }

                await pool.query(`
          INSERT INTO game_attendance (game_id, username, applied_cost)
          VALUES ($1, $2, $3)
        `, [gameId, username, playerCost]);
            }
        }

        res.status(200).json({ success: true, message: 'Game recorded successfully', gameId });
    } catch (error: any) {
        console.error('Error recording game:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ==========================================
// PAYMENT MANAGEMENT
// ==========================================

router.post('/add-payment', verifyToken, async (req: Request, res: Response) => {
    const { username, amount, method, notes, date } = req.body;
    // @ts-ignore
    const team_id = req.user?.team_id;

    if (!team_id) {
        res.status(400).json({ success: false, message: 'Team identification failed' });
        return;
    }

    try {
        await pool.query(`
      INSERT INTO payments (username, team_id, amount, method, notes, date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [username, team_id, amount, method, notes || '', date || new Date()]);

        res.status(200).json({ success: true, message: 'Payment recorded successfully' });
    } catch (error: any) {
        console.error('Error adding payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.delete('/delete-payment/:payment_id', verifyToken, async (req: Request, res: Response) => {
    const { payment_id } = req.params;
    try {
        await pool.query('DELETE FROM payments WHERE payment_id = $1', [payment_id]);
        res.status(200).json({ success: true, message: 'Payment deleted' });
    } catch (error: any) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ==========================================
// DATA RETRIEVAL
// ==========================================

router.get('/player-financials/:username', verifyToken, async (req: Request, res: Response) => {
    const { username } = req.params;

    try {
        // 1. Get Games Attended
        const attendanceQuery = `
            SELECT ga.attendance_id, ga.applied_cost, g.date, g.game_id, g.notes
            FROM game_attendance ga
            JOIN games g ON ga.game_id = g.game_id
            WHERE ga.username = $1
            ORDER BY g.date DESC
        `;
        const attendanceRes = await pool.query(attendanceQuery, [username]);

        // 2. Get Payments Made
        const paymentsQuery = `
            SELECT payment_id, amount, method, date, notes
            FROM payments
            WHERE username = $1
            ORDER BY date DESC
        `;
        const paymentsRes = await pool.query(paymentsQuery, [username]);

        // 3. Calculate Balance
        const totalCost = attendanceRes.rows.reduce((sum: number, record: any) => sum + record.applied_cost, 0);
        const totalPaid = paymentsRes.rows.reduce((sum: number, record: any) => sum + record.amount, 0);
        const balance = totalPaid - totalCost; // Positive = Credit, Negative = Debt

        // 4. Get User Settings (Custom Cost)
        const userRes = await pool.query('SELECT custom_game_cost FROM users WHERE username = $1', [username]);
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

// New endpoint to just get settings for team (for settings page)
router.get('/team-settings', verifyToken, async (req: Request, res: Response) => {
    // @ts-ignore
    const team_id = req.user?.team_id;
    if (!team_id) { res.status(400).json({ success: false, message: 'No team id' }); return; }

    try {
        const teamRes = await pool.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
        const defaultCost = teamRes.rows[0]?.default_game_cost || 0;
        res.status(200).json({ success: true, defaultGameCost: defaultCost });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});


router.get('/team-financial-summary/:team_id', verifyToken, async (req: Request, res: Response) => {
    // If team_id is distinct from token's team_id, should we allow? 
    // Usually manager can only see their own team.
    const requestedTeamId = Number(req.params.team_id);
    // @ts-ignore
    const tokenTeamId = req.user?.team_id;

    // Optional check: if (requestedTeamId !== tokenTeamId) return 403;
    // For now, trust the token mostly or the param. Let's use the param but default to token if param is weird?
    // Actually, safer to use tokenTeamId.
    const team_id = tokenTeamId || requestedTeamId;

    try {
        const usersRes = await pool.query('SELECT username FROM users WHERE team_id = $1', [team_id]);
        const users = usersRes.rows;

        const summary = [];

        for (const user of users) {
            const debtRes = await pool.query(`
                SELECT COALESCE(SUM(applied_cost), 0) as debt 
                FROM game_attendance ga
                JOIN games g ON ga.game_id = g.game_id
                WHERE ga.username = $1 AND g.team_id = $2
             `, [user.username, team_id]);

            const paidRes = await pool.query(`
                SELECT COALESCE(SUM(amount), 0) as paid 
                FROM payments 
                WHERE username = $1 AND team_id = $2
             `, [user.username, team_id]);

            const debt = parseInt(debtRes.rows[0].debt);
            const paid = parseInt(paidRes.rows[0].paid);

            summary.push({
                username: user.username,
                balance: paid - debt,
                debt,
                paid
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

// ==========================================
// SETTINGS
// ==========================================

router.put('/update-team-settings', verifyToken, async (req: Request, res: Response) => {
    const { default_game_cost } = req.body;
    // @ts-ignore
    const team_id = req.user?.team_id;

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

router.put('/update-user-financial-settings', verifyToken, async (req: Request, res: Response) => {
    const { username, custom_game_cost } = req.body;
    try {
        await pool.query('UPDATE users SET custom_game_cost = $1 WHERE username = $2', [custom_game_cost, username]);
        res.status(200).json({ success: true, message: 'User settings updated' });
    } catch (error: any) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;



import express, { Request, Response, Router } from 'express';
import pool from '../models/userModel';
import { verifyToken } from './verifyToken';
import { sendPaymentConfirmationEmail } from '../services/emailService';

const router: Router = express.Router();

// ==========================================
// GAME MANAGEMENT
// ==========================================

router.post('/record-game', verifyToken, async (req: Request, res: Response) => {
    const { date, time, enlistedPlayers, base_cost, notes, force_base_cost, specific_player_costs, specific_player_notes } = req.body;
    // @ts-ignore
    const team_id = req.user?.team_id;

    if (!team_id) {
        res.status(400).json({ success: false, message: 'Team identification failed' });
        return;
    }

    try {
        // 1. Generate game_session_id from date and time
        // Expected format: date = "2025-12-12", time = "19:00"
        // Result: game_session_id = "2025-12-12_19:00"
        let gameSessionId: string | null = null;
        if (date && time) {
            const dateOnly = date.split('T')[0]; // Ensure we only have YYYY-MM-DD
            gameSessionId = `${dateOnly}_${time}`;
        }

        // 2. Get Team Default Cost if not provided
        let costPerGame = base_cost;
        if (costPerGame === undefined || costPerGame === null) {
            const teamRes = await pool.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
            if (teamRes.rows.length === 0) {
                res.status(404).json({ success: false, message: 'Team not found' });
                return;
            }
            costPerGame = teamRes.rows[0].default_game_cost || 0;
        }

        let gameId: number;

        // 3. Check if Game Session Already Exists
        if (gameSessionId) {
            const existingGameRes = await pool.query(
                'SELECT game_id FROM games WHERE game_session_id = $1 AND team_id = $2',
                [gameSessionId, team_id]
            );

            if (existingGameRes.rows.length > 0) {
                // Game session exists, use existing game_id
                gameId = existingGameRes.rows[0].game_id;
                console.log(`Adding players to existing game session: ${gameSessionId}`);
            } else {
                // Create new game session
                const gameQuery = `
                    INSERT INTO games (team_id, date, base_cost, notes, game_session_id)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING game_id
                `;
                const gameValues = [team_id, date || new Date(), costPerGame, notes || '', gameSessionId];
                const gameResult = await pool.query(gameQuery, gameValues);
                gameId = gameResult.rows[0].game_id;
                console.log(`Created new game session: ${gameSessionId}`);
            }
        } else {
            // No session ID provided, create game without it (backward compatibility)
            const gameQuery = `
                INSERT INTO games (team_id, date, base_cost, notes)
                VALUES ($1, $2, $3, $4)
                RETURNING game_id
            `;
            const gameValues = [team_id, date || new Date(), costPerGame, notes || ''];
            const gameResult = await pool.query(gameQuery, gameValues);
            gameId = gameResult.rows[0].game_id;
        }

        // 4. Create Attendance Records
        if (enlistedPlayers && enlistedPlayers.length > 0) {
            for (const username of enlistedPlayers) {
                // Check if player already exists in this game session
                const existingAttendance = await pool.query(
                    'SELECT attendance_id FROM game_attendance WHERE game_id = $1 AND username = $2',
                    [gameId, username]
                );

                if (existingAttendance.rows.length > 0) {
                    console.log(`Player ${username} already in game session, skipping...`);
                    continue;
                }

                let playerCost = costPerGame;
                const adjustmentNote = specific_player_notes?.[username] || '';

                // Priority 1: Specific ad-hoc override from the Save Dialog
                if (specific_player_costs && specific_player_costs[username] !== undefined && specific_player_costs[username] !== null) {
                    playerCost = specific_player_costs[username];
                }
                // Priority 2: Force Base Cost (Apply to All)
                else if (force_base_cost) {
                    playerCost = costPerGame;
                }
                // Priority 3: Custom Player Settings
                else {
                    const userRes = await pool.query('SELECT custom_game_cost FROM users WHERE username = $1', [username]);
                    if (userRes.rows.length > 0 && userRes.rows[0].custom_game_cost !== null) {
                        playerCost = userRes.rows[0].custom_game_cost;
                    }
                }

                await pool.query(`
          INSERT INTO game_attendance (game_id, username, applied_cost, adjustment_note)
          VALUES ($1, $2, $3, $4)
        `, [gameId, username, playerCost, adjustmentNote]);
            }
        }

        res.status(200).json({ success: true, message: 'Game recorded successfully', gameId, gameSessionId });
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

        // Send payment confirmation email
        try {
            const userRes = await pool.query('SELECT email FROM users WHERE username = $1', [username]);
            if (userRes.rows.length > 0 && userRes.rows[0].email) {
                await sendPaymentConfirmationEmail(
                    userRes.rows[0].email,
                    username,
                    amount,
                    method,
                    date || new Date()
                );
            }
        } catch (emailError) {
            // Log but don't fail the payment if email fails
            console.error('Failed to send payment confirmation email:', emailError);
        }

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

router.delete('/delete-attendance/:attendance_id', verifyToken, async (req: Request, res: Response) => {
    const { attendance_id } = req.params;
    try {
        await pool.query('DELETE FROM game_attendance WHERE attendance_id = $1', [attendance_id]);
        res.status(200).json({ success: true, message: 'Game record deleted for player' });
    } catch (error: any) {
        console.error('Error deleting attendance:', error);
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
            SELECT ga.attendance_id, ga.applied_cost, ga.adjustment_note, g.date, g.game_id, g.notes
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

// NEW: Get list of game sessions for team
router.get('/game-sessions', verifyToken, async (req: Request, res: Response) => {
    // @ts-ignore
    const team_id = req.user?.team_id;
    if (!team_id) {
        res.status(400).json({ success: false, message: 'No team id' });
        return;
    }

    try {
        const sessionsRes = await pool.query(`
            SELECT game_id, game_session_id, date, base_cost, notes,
                   (SELECT COUNT(*) FROM game_attendance WHERE game_id = g.game_id) as player_count
            FROM games g
            WHERE team_id = $1 AND game_session_id IS NOT NULL
            ORDER BY date DESC
            LIMIT 50
        `, [team_id]);

        res.status(200).json({
            success: true,
            sessions: sessionsRes.rows
        });
    } catch (e: any) {
        console.error('Error fetching game sessions:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// NEW: Get players in a specific game session
router.get('/game-session-players/:game_session_id', verifyToken, async (req: Request, res: Response) => {
    const { game_session_id } = req.params;
    // @ts-ignore
    const team_id = req.user?.team_id;

    if (!team_id) {
        res.status(400).json({ success: false, message: 'No team id' });
        return;
    }

    try {
        // First, get the game_id from game_session_id
        const gameRes = await pool.query(
            'SELECT game_id, date, base_cost, notes FROM games WHERE game_session_id = $1 AND team_id = $2',
            [game_session_id, team_id]
        );

        if (gameRes.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Game session not found' });
            return;
        }

        const game = gameRes.rows[0];

        // Get all players in this game
        const playersRes = await pool.query(`
            SELECT ga.attendance_id, ga.username, ga.applied_cost, ga.adjustment_note
            FROM game_attendance ga
            WHERE ga.game_id = $1
            ORDER BY ga.attendance_id
        `, [game.game_id]);

        res.status(200).json({
            success: true,
            game: game,
            players: playersRes.rows
        });
    } catch (e: any) {
        console.error('Error fetching game session players:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});


// Lightweight endpoint for player balance (for Welcome Page)
router.get('/player-balance/:username', verifyToken, async (req: Request, res: Response) => {
    const { username } = req.params;
    // @ts-ignore
    const team_id = req.user?.team_id;

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
        const userRes = await pool.query('SELECT custom_game_cost FROM users WHERE username = $1', [username]);
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
        const usersRes = await pool.query('SELECT username, custom_game_cost FROM users WHERE team_id = $1', [team_id]);
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
                paid,
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

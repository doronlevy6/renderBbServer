"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userModel_1 = __importDefault(require("../models/userModel"));
const verifyToken_1 = require("./verifyToken");
const emailService_1 = require("../services/emailService");
const router = express_1.default.Router();
// ==========================================
// GAME MANAGEMENT
// ==========================================
router.post('/record-game', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { date, enlistedPlayers, base_cost, notes, force_base_cost, specific_player_costs, specific_player_notes } = req.body;
    // @ts-ignore
    const team_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
    if (!team_id) {
        res.status(400).json({ success: false, message: 'Team identification failed' });
        return;
    }
    try {
        // 1. Get Team Default Cost if not provided
        let costPerGame = base_cost;
        if (costPerGame === undefined || costPerGame === null) {
            const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
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
        const gameResult = yield userModel_1.default.query(gameQuery, gameValues);
        const gameId = gameResult.rows[0].game_id;
        // 3. Create Attendance Records
        if (enlistedPlayers && enlistedPlayers.length > 0) {
            for (const username of enlistedPlayers) {
                let playerCost = costPerGame;
                const adjustmentNote = (specific_player_notes === null || specific_player_notes === void 0 ? void 0 : specific_player_notes[username]) || '';
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
                    const userRes = yield userModel_1.default.query('SELECT custom_game_cost FROM users WHERE username = $1', [username]);
                    if (userRes.rows.length > 0 && userRes.rows[0].custom_game_cost !== null) {
                        playerCost = userRes.rows[0].custom_game_cost;
                    }
                }
                yield userModel_1.default.query(`
          INSERT INTO game_attendance (game_id, username, applied_cost, adjustment_note)
          VALUES ($1, $2, $3, $4)
        `, [gameId, username, playerCost, adjustmentNote]);
            }
        }
        res.status(200).json({ success: true, message: 'Game recorded successfully', gameId });
    }
    catch (error) {
        console.error('Error recording game:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
// ==========================================
// PAYMENT MANAGEMENT
// ==========================================
router.post('/add-payment', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { username, amount, method, notes, date } = req.body;
    // @ts-ignore
    const team_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
    if (!team_id) {
        res.status(400).json({ success: false, message: 'Team identification failed' });
        return;
    }
    try {
        yield userModel_1.default.query(`
      INSERT INTO payments (username, team_id, amount, method, notes, date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [username, team_id, amount, method, notes || '', date || new Date()]);
        // Send payment confirmation email
        try {
            const userRes = yield userModel_1.default.query('SELECT email FROM users WHERE username = $1', [username]);
            if (userRes.rows.length > 0 && userRes.rows[0].email) {
                yield (0, emailService_1.sendPaymentConfirmationEmail)(userRes.rows[0].email, username, amount, method, date || new Date());
            }
        }
        catch (emailError) {
            // Log but don't fail the payment if email fails
            console.error('Failed to send payment confirmation email:', emailError);
        }
        res.status(200).json({ success: true, message: 'Payment recorded successfully' });
    }
    catch (error) {
        console.error('Error adding payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
router.delete('/delete-payment/:payment_id', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { payment_id } = req.params;
    try {
        yield userModel_1.default.query('DELETE FROM payments WHERE payment_id = $1', [payment_id]);
        res.status(200).json({ success: true, message: 'Payment deleted' });
    }
    catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
router.delete('/delete-attendance/:attendance_id', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { attendance_id } = req.params;
    try {
        yield userModel_1.default.query('DELETE FROM game_attendance WHERE attendance_id = $1', [attendance_id]);
        res.status(200).json({ success: true, message: 'Game record deleted for player' });
    }
    catch (error) {
        console.error('Error deleting attendance:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
// ==========================================
// DATA RETRIEVAL
// ==========================================
router.get('/player-financials/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
        const attendanceRes = yield userModel_1.default.query(attendanceQuery, [username]);
        // 2. Get Payments Made
        const paymentsQuery = `
            SELECT payment_id, amount, method, date, notes
            FROM payments
            WHERE username = $1
            ORDER BY date DESC
        `;
        const paymentsRes = yield userModel_1.default.query(paymentsQuery, [username]);
        // 3. Calculate Balance
        const totalCost = attendanceRes.rows.reduce((sum, record) => sum + record.applied_cost, 0);
        const totalPaid = paymentsRes.rows.reduce((sum, record) => sum + record.amount, 0);
        const balance = totalPaid - totalCost; // Positive = Credit, Negative = Debt
        // 4. Get User Settings (Custom Cost)
        const userRes = yield userModel_1.default.query('SELECT custom_game_cost FROM users WHERE username = $1', [username]);
        const customCost = ((_a = userRes.rows[0]) === null || _a === void 0 ? void 0 : _a.custom_game_cost) || null;
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
    }
    catch (error) {
        console.error('Error fetching player financials:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
// New endpoint to just get settings for team (for settings page)
router.get('/team-settings', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // @ts-ignore
    const team_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
    if (!team_id) {
        res.status(400).json({ success: false, message: 'No team id' });
        return;
    }
    try {
        const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
        const defaultCost = ((_b = teamRes.rows[0]) === null || _b === void 0 ? void 0 : _b.default_game_cost) || 0;
        res.status(200).json({ success: true, defaultGameCost: defaultCost });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}));
// Lightweight endpoint for player balance (for Welcome Page)
router.get('/player-balance/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { username } = req.params;
    // @ts-ignore
    const team_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
    try {
        // 1. Get total game costs
        const costQuery = `
            SELECT COALESCE(SUM(ga.applied_cost), 0) as total_owed
            FROM game_attendance ga
            JOIN games g ON ga.game_id = g.game_id
            WHERE ga.username = $1 AND g.team_id = $2
        `;
        const costRes = yield userModel_1.default.query(costQuery, [username, team_id]);
        const totalOwed = parseInt(costRes.rows[0].total_owed);
        // 2. Get total payments
        const payQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_paid
            FROM payments
            WHERE username = $1 AND team_id = $2
        `;
        const payRes = yield userModel_1.default.query(payQuery, [username, team_id]);
        const totalPaid = parseInt(payRes.rows[0].total_paid);
        // 3. Get player's cost per game
        const userRes = yield userModel_1.default.query('SELECT custom_game_cost FROM users WHERE username = $1', [username]);
        const customCost = (_b = userRes.rows[0]) === null || _b === void 0 ? void 0 : _b.custom_game_cost;
        // If no custom cost, get team default
        let costPerGame = customCost;
        if (customCost === null) {
            const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
            costPerGame = ((_c = teamRes.rows[0]) === null || _c === void 0 ? void 0 : _c.default_game_cost) || 30;
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
    }
    catch (error) {
        console.error('Error fetching player balance:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
router.get('/team-financial-summary/:team_id', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // If team_id is distinct from token's team_id, should we allow? 
    // Usually manager can only see their own team.
    const requestedTeamId = Number(req.params.team_id);
    // @ts-ignore
    const tokenTeamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
    // Optional check: if (requestedTeamId !== tokenTeamId) return 403;
    // For now, trust the token mostly or the param. Let's use the param but default to token if param is weird?
    // Actually, safer to use tokenTeamId.
    const team_id = tokenTeamId || requestedTeamId;
    try {
        const usersRes = yield userModel_1.default.query('SELECT username, custom_game_cost FROM users WHERE team_id = $1', [team_id]);
        const users = usersRes.rows;
        const summary = [];
        for (const user of users) {
            const debtRes = yield userModel_1.default.query(`
                SELECT COALESCE(SUM(applied_cost), 0) as debt 
                FROM game_attendance ga
                JOIN games g ON ga.game_id = g.game_id
                WHERE ga.username = $1 AND g.team_id = $2
             `, [user.username, team_id]);
            const paidRes = yield userModel_1.default.query(`
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
        const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
        const defaultCost = ((_b = teamRes.rows[0]) === null || _b === void 0 ? void 0 : _b.default_game_cost) || 0;
        res.status(200).json({ success: true, summary, defaultGameCost: defaultCost });
    }
    catch (error) {
        console.error('Error fetching team summary:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
// ==========================================
// SETTINGS
// ==========================================
router.put('/update-team-settings', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { default_game_cost } = req.body;
    // @ts-ignore
    const team_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
    if (!team_id) {
        res.status(400).json({ success: false, message: 'Team identification failed' });
        return;
    }
    try {
        yield userModel_1.default.query('UPDATE teams SET default_game_cost = $1 WHERE team_id = $2', [default_game_cost, team_id]);
        res.status(200).json({ success: true, message: 'Team settings updated' });
    }
    catch (error) {
        console.error('Error updating team settings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
router.put('/update-user-financial-settings', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, custom_game_cost } = req.body;
    try {
        yield userModel_1.default.query('UPDATE users SET custom_game_cost = $1 WHERE username = $2', [custom_game_cost, username]);
        res.status(200).json({ success: true, message: 'User settings updated' });
    }
    catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}));
exports.default = router;

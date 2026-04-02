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
exports.registerFinanceReportRoutes = registerFinanceReportRoutes;
const userModel_1 = __importDefault(require("../../models/userModel"));
const verifyToken_1 = require("../verifyToken");
const authz_1 = require("../authz");
function getPlayerFinancialPayload(teamId, username) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const attendanceQuery = `
        SELECT ga.attendance_id, ga.applied_cost, ga.adjustment_note, g.date, g.game_id, g.notes
        FROM game_attendance ga
        JOIN games g ON ga.game_id = g.game_id
        WHERE ga.username = $1 AND g.team_id = $2
        ORDER BY g.date DESC
    `;
        const attendanceRes = yield userModel_1.default.query(attendanceQuery, [username, teamId]);
        const paymentsQuery = `
        SELECT payment_id, amount, method, date, notes
        FROM payments
        WHERE username = $1 AND team_id = $2
        ORDER BY date DESC NULLS LAST, payment_id DESC
    `;
        const paymentsRes = yield userModel_1.default.query(paymentsQuery, [username, teamId]);
        const totalCost = attendanceRes.rows.reduce((sum, record) => sum + record.applied_cost, 0);
        const totalPaid = paymentsRes.rows.reduce((sum, record) => sum + record.amount, 0);
        const balance = totalPaid - totalCost;
        const userRes = yield userModel_1.default.query('SELECT custom_game_cost FROM users WHERE username = $1 AND team_id = $2', [username, teamId]);
        const customCost = (_b = (_a = userRes.rows[0]) === null || _a === void 0 ? void 0 : _a.custom_game_cost) !== null && _b !== void 0 ? _b : null;
        const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [teamId]);
        const defaultCost = (_d = (_c = teamRes.rows[0]) === null || _c === void 0 ? void 0 : _c.default_game_cost) !== null && _d !== void 0 ? _d : 30;
        const costPerGame = customCost !== null && customCost !== void 0 ? customCost : defaultCost;
        let gamesEquivalent = 0;
        let remainder = balance;
        if (costPerGame > 0) {
            if (balance >= 0) {
                gamesEquivalent = Math.floor(balance / costPerGame);
            }
            else {
                const debtAbs = -balance;
                const debtGames = Math.ceil(debtAbs / costPerGame);
                gamesEquivalent = -debtGames;
            }
            remainder = balance - gamesEquivalent * costPerGame;
        }
        const lastPayment = paymentsRes.rows.length > 0 ? paymentsRes.rows[0] : null;
        return {
            balance,
            totalCost,
            totalPaid,
            customGameCost: customCost,
            costPerGame,
            gamesEquivalent,
            remainder,
            gamesPlayed: attendanceRes.rows.length,
            lastPaymentAmount: (lastPayment === null || lastPayment === void 0 ? void 0 : lastPayment.amount) == null ? null : parseInt(String(lastPayment.amount), 10),
            lastPaymentDate: (_e = lastPayment === null || lastPayment === void 0 ? void 0 : lastPayment.date) !== null && _e !== void 0 ? _e : null,
            history: {
                games: attendanceRes.rows,
                payments: paymentsRes.rows,
            },
        };
    });
}
function registerFinanceReportRoutes(router) {
    // Current user's wallet details (always own user).
    router.get('/my-financials', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const team_id = (0, authz_1.getTeamId)(req);
        const requester = (0, authz_1.getUsername)(req);
        if (!team_id || !requester) {
            res.status(400).json({ success: false, message: 'Team identification failed' });
            return;
        }
        try {
            const payload = yield getPlayerFinancialPayload(team_id, requester);
            res.status(200).json(Object.assign({ success: true }, payload));
        }
        catch (error) {
            console.error('Error fetching my financials:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }));
    // Financial details: manager can read any team member, player can read only self.
    router.get('/player-financials/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { username } = req.params;
        const team_id = (0, authz_1.getTeamId)(req);
        const requester = (0, authz_1.getUsername)(req);
        const manager = (0, authz_1.isManager)(req);
        if (!team_id || !requester) {
            res.status(400).json({ success: false, message: 'Team identification failed' });
            return;
        }
        if (!manager && requester !== username) {
            res.status(403).json({ success: false, message: 'Not authorized to view this player' });
            return;
        }
        try {
            const payload = yield getPlayerFinancialPayload(team_id, username);
            res.status(200).json(Object.assign({ success: true }, payload));
        }
        catch (error) {
            console.error('Error fetching player financials:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }));
    // Lightweight endpoint for player balance (for Welcome Page)
    router.get('/player-balance/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { username } = req.params;
        const team_id = (0, authz_1.getTeamId)(req);
        const requester = (0, authz_1.getUsername)(req);
        const manager = (0, authz_1.isManager)(req);
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
            const userRes = yield userModel_1.default.query('SELECT custom_game_cost FROM users WHERE username = $1 AND team_id = $2', [username, team_id]);
            const customCost = (_a = userRes.rows[0]) === null || _a === void 0 ? void 0 : _a.custom_game_cost;
            // If no custom cost, get team default
            let costPerGame = customCost;
            if (customCost === null) {
                const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
                costPerGame = ((_b = teamRes.rows[0]) === null || _b === void 0 ? void 0 : _b.default_game_cost) || 30;
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
    // Team financial summary is manager-only.
    router.get('/team-financial-summary/:team_id', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const requestedTeamId = Number(req.params.team_id);
        const team_id = (0, authz_1.getTeamId)(req);
        if (!team_id) {
            res.status(400).json({ success: false, message: 'Team identification failed' });
            return;
        }
        if (requestedTeamId && requestedTeamId !== team_id) {
            res.status(403).json({ success: false, message: 'Not authorized for this team' });
            return;
        }
        try {
            const usersRes = yield userModel_1.default.query('SELECT username, custom_game_cost, role FROM users WHERE team_id = $1', [team_id]);
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
                const lastPaymentRes = yield userModel_1.default.query(`
                SELECT amount, date
                FROM payments
                WHERE username = $1 AND team_id = $2
                ORDER BY date DESC NULLS LAST, payment_id DESC
                LIMIT 1
             `, [user.username, team_id]);
                const debt = parseInt(debtRes.rows[0].debt);
                const paid = parseInt(paidRes.rows[0].paid);
                const lastPayment = lastPaymentRes.rows[0];
                summary.push({
                    username: user.username,
                    role: user.role || 'player',
                    balance: paid - debt,
                    debt,
                    paid,
                    last_payment_amount: (lastPayment === null || lastPayment === void 0 ? void 0 : lastPayment.amount) == null ? null : parseInt(lastPayment.amount),
                    last_payment_date: (lastPayment === null || lastPayment === void 0 ? void 0 : lastPayment.date) || null,
                    custom_game_cost: user.custom_game_cost
                });
            }
            const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
            const defaultCost = ((_a = teamRes.rows[0]) === null || _a === void 0 ? void 0 : _a.default_game_cost) || 0;
            res.status(200).json({ success: true, summary, defaultGameCost: defaultCost });
        }
        catch (error) {
            console.error('Error fetching team summary:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }));
    // Full team financial history is manager-only.
    router.get('/all-players-history/:team_id', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const requestedTeamId = Number(req.params.team_id);
        const team_id = (0, authz_1.getTeamId)(req);
        if (!team_id) {
            res.status(400).json({ success: false, message: 'Team identification failed' });
            return;
        }
        if (requestedTeamId && requestedTeamId !== team_id) {
            res.status(403).json({ success: false, message: 'Not authorized for this team' });
            return;
        }
        try {
            const usersRes = yield userModel_1.default.query('SELECT username, custom_game_cost, role FROM users WHERE team_id = $1', [team_id]);
            const users = usersRes.rows;
            const allData = {};
            // Parallelize the data fetching for all users
            yield Promise.all(users.map((user) => __awaiter(this, void 0, void 0, function* () {
                const username = user.username;
                // 1. Get Games Attended
                const attendanceQuery = `
                SELECT ga.attendance_id, ga.applied_cost, ga.adjustment_note, g.date, g.game_id, g.notes
                FROM game_attendance ga
                JOIN games g ON ga.game_id = g.game_id
                WHERE ga.username = $1 AND g.team_id = $2
                ORDER BY g.date DESC
            `;
                const attendanceRes = yield userModel_1.default.query(attendanceQuery, [username, team_id]);
                // 2. Get Payments Made
                const paymentsQuery = `
                SELECT payment_id, amount, method, date, notes
                FROM payments
                WHERE username = $1 AND team_id = $2
                ORDER BY date DESC NULLS LAST, payment_id DESC
            `;
                const paymentsRes = yield userModel_1.default.query(paymentsQuery, [username, team_id]);
                // 3. Calculate Balance
                const totalCost = attendanceRes.rows.reduce((sum, record) => sum + record.applied_cost, 0);
                const totalPaid = paymentsRes.rows.reduce((sum, record) => sum + record.amount, 0);
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
            })));
            res.status(200).json({ success: true, allPlayersData: allData });
        }
        catch (error) {
            console.error('Error fetching all players history:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }));
}

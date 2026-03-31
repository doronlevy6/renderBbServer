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
function registerFinanceReportRoutes(router) {
    router.get('/player-financials/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    // Lightweight endpoint for player balance (for Welcome Page)
    router.get('/player-balance/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    router.get('/team-financial-summary/:team_id', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const requestedTeamId = Number(req.params.team_id);
        // @ts-ignore
        const tokenTeamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
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
    // NEW: Get full financial history for ALL players in the team (for efficient preloading)
    router.get('/all-players-history/:team_id', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const requestedTeamId = Number(req.params.team_id);
        // @ts-ignore
        const tokenTeamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
        const team_id = tokenTeamId || requestedTeamId;
        try {
            const usersRes = yield userModel_1.default.query('SELECT username, custom_game_cost FROM users WHERE team_id = $1', [team_id]);
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
                const balance = totalPaid - totalCost;
                allData[username] = {
                    success: true,
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

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
exports.registerGameRoutes = registerGameRoutes;
const userModel_1 = __importDefault(require("../../models/userModel"));
const verifyToken_1 = require("../verifyToken");
const authz_1 = require("../authz");
const socket_1 = require("../../socket/socket");
function registerGameRoutes(router) {
    // Game recording is restricted to managers only.
    router.post('/record-game', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { date, time, enlistedPlayers, base_cost, notes, force_base_cost, specific_player_costs, specific_player_notes, } = req.body;
        const team_id = (0, authz_1.getTeamId)(req);
        if (!team_id) {
            res.status(400).json({ success: false, message: 'Team identification failed' });
            return;
        }
        try {
            // 1. Generate game_session_id from date and time
            let gameSessionId = null;
            if (date && time) {
                const dateOnly = date.split('T')[0]; // Ensure we only have YYYY-MM-DD
                gameSessionId = `${dateOnly}_${time}`;
            }
            // 2. Get Team Default Cost if not provided
            let costPerGame = base_cost;
            if (costPerGame === undefined || costPerGame === null) {
                const teamRes = yield userModel_1.default.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
                if (teamRes.rows.length === 0) {
                    res.status(404).json({ success: false, message: 'Team not found' });
                    return;
                }
                costPerGame = teamRes.rows[0].default_game_cost || 0;
            }
            let gameId;
            // 3. Check if Game Session Already Exists
            if (gameSessionId) {
                const existingGameRes = yield userModel_1.default.query('SELECT game_id FROM games WHERE game_session_id = $1 AND team_id = $2', [gameSessionId, team_id]);
                if (existingGameRes.rows.length > 0) {
                    // Game session exists, use existing game_id
                    gameId = existingGameRes.rows[0].game_id;
                    console.log(`Adding players to existing game session: ${gameSessionId}`);
                }
                else {
                    // Create new game session
                    const gameQuery = `
                    INSERT INTO games (team_id, date, base_cost, notes, game_session_id)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING game_id
                `;
                    const gameValues = [team_id, date || new Date(), costPerGame, notes || '', gameSessionId];
                    const gameResult = yield userModel_1.default.query(gameQuery, gameValues);
                    gameId = gameResult.rows[0].game_id;
                    console.log(`Created new game session: ${gameSessionId}`);
                }
            }
            else {
                // No session ID provided, create game without it (backward compatibility)
                const gameQuery = `
                INSERT INTO games (team_id, date, base_cost, notes)
                VALUES ($1, $2, $3, $4)
                RETURNING game_id
            `;
                const gameValues = [team_id, date || new Date(), costPerGame, notes || ''];
                const gameResult = yield userModel_1.default.query(gameQuery, gameValues);
                gameId = gameResult.rows[0].game_id;
            }
            // 4. Create Attendance Records
            if (enlistedPlayers && enlistedPlayers.length > 0) {
                for (const username of enlistedPlayers) {
                    // Check if player already exists in this game session
                    const existingAttendance = yield userModel_1.default.query('SELECT attendance_id FROM game_attendance WHERE game_id = $1 AND username = $2', [gameId, username]);
                    if (existingAttendance.rows.length > 0) {
                        console.log(`Player ${username} already in game session, skipping...`);
                        continue;
                    }
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
                        const userRes = yield userModel_1.default.query('SELECT custom_game_cost FROM users WHERE username = $1 AND team_id = $2', [username, team_id]);
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
            (0, socket_1.emitToTeam)(team_id, 'financeSummaryUpdated', {
                team_id,
                game_id: gameId,
                game_session_id: gameSessionId,
                source: 'record-game',
                at: new Date().toISOString(),
            });
            res.status(200).json({ success: true, message: 'Game recorded successfully', gameId, gameSessionId });
        }
        catch (error) {
            console.error('Error recording game:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }));
    router.delete('/delete-attendance/:attendance_id', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { attendance_id } = req.params;
        const team_id = (0, authz_1.getTeamId)(req);
        if (!team_id) {
            res.status(400).json({ success: false, message: 'Team identification failed' });
            return;
        }
        try {
            const deleteRes = yield userModel_1.default.query(`
          DELETE FROM game_attendance ga
          USING games g
          WHERE ga.attendance_id = $1
            AND ga.game_id = g.game_id
            AND g.team_id = $2
        `, [attendance_id, team_id]);
            if (deleteRes.rowCount === 0) {
                res.status(404).json({ success: false, message: 'Attendance record not found' });
                return;
            }
            (0, socket_1.emitToTeam)(team_id, 'financeSummaryUpdated', {
                team_id,
                attendance_id,
                source: 'delete-attendance',
                at: new Date().toISOString(),
            });
            res.status(200).json({ success: true, message: 'Game record deleted for player' });
        }
        catch (error) {
            console.error('Error deleting attendance:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }));
    // NEW: Get list of game sessions for team
    router.get('/game-sessions', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const team_id = (0, authz_1.getTeamId)(req);
        if (!team_id) {
            res.status(400).json({ success: false, message: 'No team id' });
            return;
        }
        try {
            const sessionsRes = yield userModel_1.default.query(`
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
        }
        catch (e) {
            console.error('Error fetching game sessions:', e);
            res.status(500).json({ success: false, message: e.message });
        }
    }));
    // NEW: Get players in a specific game session
    router.get('/game-session-players/:game_session_id', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { game_session_id } = req.params;
        const team_id = (0, authz_1.getTeamId)(req);
        if (!team_id) {
            res.status(400).json({ success: false, message: 'No team id' });
            return;
        }
        try {
            // First, get the game_id from game_session_id
            const gameRes = yield userModel_1.default.query('SELECT game_id, date, base_cost, notes FROM games WHERE game_session_id = $1 AND team_id = $2', [game_session_id, team_id]);
            if (gameRes.rows.length === 0) {
                res.status(404).json({ success: false, message: 'Game session not found' });
                return;
            }
            const game = gameRes.rows[0];
            // Get all players in this game
            const playersRes = yield userModel_1.default.query(`
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
        }
        catch (e) {
            console.error('Error fetching game session players:', e);
            res.status(500).json({ success: false, message: e.message });
        }
    }));
}

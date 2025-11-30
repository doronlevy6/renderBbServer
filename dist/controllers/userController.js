"use strict";
// src/controllers/userController.ts
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
const userService_1 = __importDefault(require("../services/userService"));
const balancedTeamsService_1 = __importDefault(require("../services/balancedTeamsService"));
const verifyToken_1 = require("./verifyToken");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const teamService_1 = __importDefault(require("../services/teamService"));
const userModel_1 = __importDefault(require("../models/userModel")); // Import pool for rollback
const router = express_1.default.Router();
router.post('/create-team', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { team_name, team_password, team_type } = req.body;
    try {
        const team = yield teamService_1.default.createTeam(team_name, team_password, team_type);
        res.status(201).json({ success: true, team });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, email, teamName, teamPassword, teamType } = req.body;
    let teamId; // Declare outside try block
    try {
        // If teamType is provided, we are creating a new team
        if (teamType) {
            // Check if team name already exists
            const existingTeam = yield teamService_1.default.getTeamByName(teamName);
            if (existingTeam) {
                res.status(400).json({ success: false, message: 'Team name already exists' });
                return;
            }
            if (!teamPassword) {
                res.status(400).json({ success: false, message: 'Team password is required' });
                return;
            }
            // Create the team
            const newTeam = yield teamService_1.default.createTeam(teamName, teamPassword, teamType);
            teamId = newTeam.team_id;
        }
        else {
            // Joining an existing team
            const team = yield teamService_1.default.getTeamByName(teamName);
            if (!team) {
                res.status(400).json({ success: false, message: 'Team not found' });
                return;
            }
            if (team.team_password !== teamPassword) {
                res
                    .status(400)
                    .json({ success: false, message: 'Invalid team password' });
                return;
            }
            teamId = team.team_id;
        }
        // Check if this is the first user in the team (for role assignment)
        const existingUsers = yield userService_1.default.getAllUsernames(teamId);
        const role = existingUsers.length === 0 ? 'manager' : 'player';
        const user = yield userService_1.default.createUser(username, password, email, teamId, role);
        res.status(201).json({ success: true, user });
    }
    catch (err) {
        // Rollback: If we created a new team but user creation failed, delete the team
        if (teamType && teamId) { // Check if teamType was provided and teamId was set
            try {
                console.log(`Rolling back team creation for teamId: ${teamId}`);
                yield userModel_1.default.query('DELETE FROM teams WHERE team_id = $1', [teamId]);
            }
            catch (rollbackErr) {
                console.error('Failed to rollback team creation', rollbackErr);
            }
        }
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    console.log(username + 'connected');
    try {
        const user = yield userService_1.default.loginUser(username, password);
        if (user) {
            const token = jsonwebtoken_1.default.sign({
                username: user.username,
                userEmail: user.email,
                team_id: user.team_id,
            }, process.env.JWT_SECRET, // השתמש במשתנה סביבה
            { expiresIn: '20h' } // Token expires in 20 hours
            );
            const isAdmin = user.role === 'manager';
            res.status(200).json({ success: true, user, token, is_admin: isAdmin });
        }
        else {
            res
                .status(401)
                .json({ success: false, message: 'Invalid credentials' });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.get('/usernames', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // @ts-ignore
        const teamid = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
        const usernames = yield userService_1.default.getAllUsernames(teamid);
        console.log('teamid', teamid);
        res
            .status(200)
            .json({ success: true, usernames: usernames.map((u) => u.username) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/rankings', verifyToken_1.verifyToken, // Add verifyToken middleware
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { rater_username, rankings } = req.body;
    // @ts-ignore
    const teamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id; // Get teamId from token
    // לוגיקה להוספת רמות
    try {
        // סינון הדירוגים
        const validRankings = rankings.filter((player) => {
            const attributes = Object.keys(player).filter((key) => key !== 'username');
            const allValid = attributes.every((key) => {
                const value = player[key];
                const isValid = typeof value === 'number' &&
                    !isNaN(value) &&
                    value >= 1 &&
                    value <= 10;
                if (!isValid) {
                    console.log(`Player ${player.username} left out due to invalid value for ${key}: ${value}. ` +
                        `Expected type: number between 1 and 10, ` +
                        `but got type: ${typeof value} with value: ${value}`);
                }
                return isValid;
            });
            return allValid;
        });
        console.log('rater_username', rater_username);
        yield userService_1.default.storePlayerRankings(rater_username, validRankings, teamId);
        res.status(200).json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.get('/rankings/:username', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username } = req.params;
    try {
        const rankings = yield userService_1.default.getPlayerRankings(username);
        res.status(200).json({ success: true, rankings });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
// עדכון הנתיב כך שישתמש ב-verifyToken לקבלת team_id מהטוקן
router.get('/enlist', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // @ts-ignore
        const teamId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id) || 1;
        const usernames = yield userService_1.default.getAllEnlistedUsers(teamId);
        res.status(200).json({ success: true, usernames });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/delete-enlist', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { usernames, isTierMethod } = req.body;
        yield userService_1.default.deleteEnlistedUsers(usernames);
        // await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod);
        res.status(200).json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/enlist-users', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { usernames, isTierMethod } = req.body;
        // @ts-ignore
        const teamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
        yield userService_1.default.enlistUsersBox(usernames, teamId);
        // await balancedTeamsService.setBalancedTeams(getIo(), isTierMethod); // Pass method to function//!
        res.status(200).json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.get('/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // נניח שיש לכם מתודה ב-teamService בשם getAllTeams
        const teams = yield userService_1.default.getAllTeams();
        res.status(200).json({ success: true, teams });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.get('/players-rankings/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const username = req.params.username;
    // @ts-ignore
    const teamId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id) || 1;
    try {
        const playersRankings = yield balancedTeamsService_1.default.getAllPlayersRankingsFromUser(username, teamId);
        res.status(200).json({ success: true, playersRankings });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
// routes.js or your router file
// עדכון הנתיב כך שמעבירים את teamId לשירות:
router.get('/players-rankings', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // @ts-ignore
        const teamId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id) || 1;
        const playersRankings = yield balancedTeamsService_1.default.getAllPlayersRankings(teamId);
        res.status(200).json({ success: true, playersRankings });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
// --- Management Endpoints ---
router.get('/players', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // @ts-ignore
        const teamId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id) || 1;
        const users = yield userService_1.default.getAllUsers(teamId);
        res.status(200).json({ success: true, users });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/add-player', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { username, password, email, teamId } = req.body;
    try {
        // @ts-ignore
        const requesterTeamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
        // If teamId is not provided, use the requester's teamId
        const targetTeamId = teamId || requesterTeamId;
        if (!targetTeamId) {
            res.status(400).json({ success: false, message: 'Team ID is required. Please ensure you are logged in and associated with a team.' });
            return;
        }
        const user = yield userService_1.default.createUser(username, password || '123456', email || '', targetTeamId);
        res.status(201).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.delete('/delete-player/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username } = req.params;
    try {
        yield userService_1.default.deleteUser(username);
        res.status(200).json({ success: true, message: 'Player deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.put('/update-player/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username } = req.params;
    const { newUsername, newEmail, newPassword } = req.body;
    try {
        const user = yield userService_1.default.updateUser(username, newUsername, newEmail, newPassword);
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
exports.default = router;

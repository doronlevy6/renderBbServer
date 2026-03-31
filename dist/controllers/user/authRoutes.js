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
exports.registerAuthRoutes = registerAuthRoutes;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userService_1 = __importDefault(require("../../services/userService"));
const teamService_1 = __importDefault(require("../../services/teamService"));
const userModel_1 = __importDefault(require("../../models/userModel"));
function registerAuthRoutes(router) {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '45d';
    // Team creation functionality (used by registration flow).
    router.post('/create-team', (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { team_name, team_password, team_type } = req.body;
        try {
            const team = yield teamService_1.default.createTeam(team_name, team_password, team_type);
            res.status(201).json({ success: true, team });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // User registration functionality (new team creation or join existing team).
    router.post('/register', (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { username, password, email, teamName, teamPassword, teamType } = req.body;
        let teamId;
        try {
            if (teamType) {
                const existingTeam = yield teamService_1.default.getTeamByName(teamName);
                if (existingTeam) {
                    res
                        .status(400)
                        .json({ success: false, message: 'Team name already exists' });
                    return;
                }
                if (!teamPassword) {
                    res
                        .status(400)
                        .json({
                        success: false,
                        message: 'Team password is required',
                    });
                    return;
                }
                const newTeam = yield teamService_1.default.createTeam(teamName, teamPassword, teamType);
                teamId = newTeam.team_id;
            }
            else {
                const team = yield teamService_1.default.getTeamByName(teamName);
                if (!team) {
                    res
                        .status(400)
                        .json({ success: false, message: 'Team not found' });
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
            const existingUsers = yield userService_1.default.getAllUsernames(teamId);
            const role = existingUsers.length === 0 ? 'manager' : 'player';
            const user = yield userService_1.default.createUser(username, password, email, teamId, role);
            res.status(201).json({ success: true, user });
        }
        catch (err) {
            // Rollback team when registration fails after team creation.
            if (teamType && teamId) {
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
    // User login functionality (JWT + role flags).
    router.post('/login', (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { username, password } = req.body;
        console.log(username + 'connected');
        if (!jwtSecret) {
            res
                .status(500)
                .json({ success: false, message: 'Server JWT is not configured' });
            return;
        }
        try {
            const user = yield userService_1.default.loginUser(username, password);
            if (user) {
                const token = jsonwebtoken_1.default.sign({
                    username: user.username,
                    userEmail: user.email,
                    team_id: user.team_id,
                    role: user.role || 'player',
                }, jwtSecret, { expiresIn: jwtExpiresIn });
                const isAdmin = user.role === 'manager';
                res
                    .status(200)
                    .json({
                    success: true,
                    user,
                    token,
                    is_admin: isAdmin,
                    token_expires_in: jwtExpiresIn,
                });
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
}

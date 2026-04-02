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
const sessionTokenService_1 = __importDefault(require("../../services/sessionTokenService"));
function parseJwtExpiresIn(rawValue) {
    const fallback = '45d';
    if (!rawValue)
        return fallback;
    const normalized = rawValue.trim();
    if (normalized === '')
        return fallback;
    // Accept pure numeric values as seconds.
    if (/^\d+$/.test(normalized)) {
        return Number(normalized);
    }
    // Duration strings like 45d/12h are valid for jsonwebtoken.
    return normalized;
}
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim() !== '') {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || null;
}
function buildAccessToken(payload, jwtSecret, jwtExpiresIn) {
    return jsonwebtoken_1.default.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
}
function registerAuthRoutes(router) {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = parseJwtExpiresIn(process.env.JWT_EXPIRES_IN);
    const jwtExpiresInLabel = String(jwtExpiresIn);
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
                const teamId = user.team_id;
                if (!teamId) {
                    res
                        .status(400)
                        .json({ success: false, message: 'User is not linked to a team' });
                    return;
                }
                const role = user.role || 'player';
                const token = buildAccessToken({
                    username: user.username,
                    userEmail: user.email,
                    team_id: teamId,
                    role,
                }, jwtSecret, jwtExpiresIn);
                const refreshTokenSession = yield sessionTokenService_1.default.issueRefreshToken({
                    username: user.username,
                    teamId,
                    userAgent: req.get('user-agent') || null,
                    ipAddress: getClientIp(req),
                });
                const isAdmin = role === 'manager';
                res
                    .status(200)
                    .json({
                    success: true,
                    user,
                    token,
                    refresh_token: refreshTokenSession.refreshToken,
                    is_admin: isAdmin,
                    token_expires_in: jwtExpiresInLabel,
                    refresh_token_expires_in: refreshTokenSession.refreshTokenExpiresIn,
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
    // Refresh access token with refresh token rotation.
    router.post('/refresh-token', (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!jwtSecret) {
            res
                .status(500)
                .json({ success: false, message: 'Server JWT is not configured' });
            return;
        }
        const refreshToken = (_a = req.body) === null || _a === void 0 ? void 0 : _a.refresh_token;
        if (!refreshToken) {
            res
                .status(400)
                .json({ success: false, message: 'Refresh token is required' });
            return;
        }
        try {
            const rotated = yield sessionTokenService_1.default.rotateRefreshToken(refreshToken, {
                userAgent: req.get('user-agent') || null,
                ipAddress: getClientIp(req),
            });
            if (!rotated) {
                res
                    .status(401)
                    .json({ success: false, message: 'Refresh token is invalid or expired' });
                return;
            }
            const role = rotated.user.role || 'player';
            const accessToken = buildAccessToken({
                username: rotated.user.username,
                userEmail: rotated.user.email,
                team_id: rotated.user.team_id,
                role,
            }, jwtSecret, jwtExpiresIn);
            res.status(200).json({
                success: true,
                token: accessToken,
                refresh_token: rotated.refreshToken,
                token_expires_in: jwtExpiresInLabel,
                refresh_token_expires_in: rotated.refreshTokenExpiresIn,
                is_admin: role === 'manager',
                user: {
                    username: rotated.user.username,
                    email: rotated.user.email,
                    team_id: rotated.user.team_id,
                    role,
                    team_type: rotated.user.team_type,
                },
            });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // Revoke refresh token on logout.
    router.post('/logout', (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const refreshToken = (_a = req.body) === null || _a === void 0 ? void 0 : _a.refresh_token;
        if (!refreshToken) {
            res.status(200).json({
                success: true,
                message: 'Logged out locally (no refresh token provided)',
            });
            return;
        }
        try {
            yield sessionTokenService_1.default.revokeRefreshToken(refreshToken);
            res.status(200).json({ success: true, message: 'Logged out successfully' });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
}

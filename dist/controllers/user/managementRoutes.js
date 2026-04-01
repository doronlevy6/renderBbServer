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
exports.registerManagementRoutes = registerManagementRoutes;
const userService_1 = __importDefault(require("../../services/userService"));
const verifyToken_1 = require("../verifyToken");
const authz_1 = require("../authz");
const ALLOWED_ROLES = new Set(['manager', 'player', 'guest']);
const normalizeRole = (value) => {
    if (typeof value !== 'string')
        return 'player';
    const role = value.trim().toLowerCase();
    return role === '' ? 'player' : role;
};
function registerManagementRoutes(router) {
    // Public list of teams for registration/login flows.
    router.get('/teams', (_req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const teams = yield userService_1.default.getAllTeams();
            res.status(200).json({ success: true, teams });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // Manager view: list all players in the requester's team.
    router.get('/players', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    // Manager action: add a new player into requester's team.
    router.post('/add-player', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { username, password, email, role } = req.body;
        try {
            // @ts-ignore
            const requesterTeamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
            // @ts-ignore
            const requesterRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            const cleanUsername = username === null || username === void 0 ? void 0 : username.trim();
            const cleanEmail = (email === null || email === void 0 ? void 0 : email.trim()) || '';
            const cleanPassword = (password === null || password === void 0 ? void 0 : password.trim()) || '123456';
            const cleanRole = normalizeRole(role);
            if (requesterRole !== 'manager') {
                res
                    .status(403)
                    .json({
                    success: false,
                    message: 'Only managers can add players',
                });
                return;
            }
            if (!cleanUsername) {
                res.status(400).json({ success: false, message: 'Username is required' });
                return;
            }
            if (!requesterTeamId) {
                res.status(400).json({
                    success: false,
                    message: 'Team ID is required. Please ensure you are logged in and associated with a team.',
                });
                return;
            }
            if (!ALLOWED_ROLES.has(cleanRole)) {
                res.status(400).json({
                    success: false,
                    message: `Invalid role '${cleanRole}'. Allowed: manager, player, guest`,
                });
                return;
            }
            const user = yield userService_1.default.createUser(cleanUsername, cleanPassword, cleanEmail, requesterTeamId, cleanRole);
            res.status(201).json({ success: true, user });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // Manager action: delete player by username.
    router.delete('/delete-player/:username', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { username } = req.params;
        // @ts-ignore
        const requesterTeamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
        try {
            if (!requesterTeamId) {
                res.status(400).json({ success: false, message: 'Team identification failed' });
                return;
            }
            yield userService_1.default.deleteUser(username, requesterTeamId);
            res
                .status(200)
                .json({ success: true, message: 'Player deleted successfully' });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // Manager action: update player identity fields and optional password.
    router.put('/update-player/:username', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { username } = req.params;
        const { newUsername, newEmail, newPassword } = req.body;
        // @ts-ignore
        const requesterTeamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
        try {
            const normalizedUsername = typeof newUsername === 'string' ? newUsername.trim() : '';
            const normalizedEmail = typeof newEmail === 'string' ? newEmail.trim() : undefined;
            const normalizedPassword = typeof newPassword === 'string' && newPassword.trim() !== ''
                ? newPassword
                : undefined;
            if (!normalizedUsername) {
                res.status(400).json({ success: false, message: 'Username is required' });
                return;
            }
            if (!requesterTeamId) {
                res.status(400).json({ success: false, message: 'Team identification failed' });
                return;
            }
            const user = yield userService_1.default.updateUser(username, normalizedUsername, normalizedEmail, normalizedPassword, requesterTeamId);
            res.status(200).json({ success: true, user });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // Manager action: bulk role updates.
    router.put('/update-player-roles', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { roleUpdates } = req.body;
        try {
            // @ts-ignore
            const requesterRole = (_a = req.user) === null || _a === void 0 ? void 0 : _a.role;
            // @ts-ignore
            const requesterTeamId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.team_id;
            if (requesterRole !== 'manager') {
                res.status(403).json({
                    success: false,
                    message: 'Only managers can update roles',
                });
                return;
            }
            if (!requesterTeamId) {
                res.status(400).json({ success: false, message: 'Team identification failed' });
                return;
            }
            for (const update of roleUpdates) {
                const cleanRole = normalizeRole(update.role);
                if (!ALLOWED_ROLES.has(cleanRole)) {
                    res.status(400).json({
                        success: false,
                        message: `Invalid role '${cleanRole}' for user ${update.username}`,
                    });
                    return;
                }
                yield userService_1.default.updatePlayerRole(update.username, cleanRole, requesterTeamId);
            }
            res
                .status(200)
                .json({ success: true, message: 'Roles updated successfully' });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
}

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
exports.registerEnlistRoutes = registerEnlistRoutes;
const userService_1 = __importDefault(require("../../services/userService"));
const verifyToken_1 = require("../verifyToken");
function registerEnlistRoutes(router) {
    // Team usernames list for authenticated user team.
    router.get('/usernames', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    // Return currently enlisted players for authenticated team.
    router.get('/enlist', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    // Remove players from enlist list (kept without token middleware for backward compatibility).
    router.post('/delete-enlist', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { usernames } = req.body;
            yield userService_1.default.deleteEnlistedUsers(usernames);
            res.status(200).json({ success: true });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // Add players to enlist list for authenticated team.
    router.post('/enlist-users', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { usernames } = req.body;
            // @ts-ignore
            const teamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
            yield userService_1.default.enlistUsersBox(usernames, teamId);
            res.status(200).json({ success: true });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
}

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
exports.registerRankingRoutes = registerRankingRoutes;
const userService_1 = __importDefault(require("../../services/userService"));
const balancedTeamsService_1 = __importDefault(require("../../services/balancedTeamsService"));
const verifyToken_1 = require("../verifyToken");
const authz_1 = require("../authz");
function registerRankingRoutes(router) {
    // Save a player's rankings submission for the authenticated team.
    router.post('/rankings', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { rater_username, rankings } = req.body;
        // @ts-ignore
        const teamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
        try {
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
    // Fetch rankings submitted by a specific user.
    router.get('/rankings/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { username } = req.params;
        const requester = (0, authz_1.getUsername)(req);
        const manager = (0, authz_1.isManager)(req);
        if (!requester) {
            res.status(400).json({ success: false, message: 'Missing requester identity' });
            return;
        }
        if (!manager && requester !== username) {
            res.status(403).json({ success: false, message: 'Not authorized to view this ranking' });
            return;
        }
        try {
            const rankings = yield userService_1.default.getPlayerRankings(username);
            res.status(200).json({ success: true, rankings });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }));
    // Fetch all rankings from a specific user, enriched for balancing flows.
    router.get('/players-rankings/:username', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    // Fetch the aggregate rankings list for the authenticated team.
    router.get('/players-rankings', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
}

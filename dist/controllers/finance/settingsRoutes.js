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
exports.registerFinanceSettingsRoutes = registerFinanceSettingsRoutes;
const userModel_1 = __importDefault(require("../../models/userModel"));
const verifyToken_1 = require("../verifyToken");
function registerFinanceSettingsRoutes(router) {
    // New endpoint to just get settings for team (for settings page)
    router.get('/team-settings', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    router.put('/update-team-settings', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
    router.put('/update-user-financial-settings', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
}

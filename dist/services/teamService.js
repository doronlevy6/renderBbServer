"use strict";
// src/services/teamService.ts
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
const userModel_1 = __importDefault(require("../models/userModel")); // נניח שאותו pool מתחבר למסד הנתונים
class TeamService {
    // פונקציה ליצירת קבוצה חדשה
    createTeam(team_name, team_password, team_type) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`INSERT INTO teams (team_name, team_password, team_type)
         VALUES ($1, $2, $3)
         RETURNING *`, [team_name, team_password, team_type]);
                return result.rows[0];
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to create team');
            }
        });
    }
    // ב-teamService.ts
    getTeamByName(teamName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query('SELECT * FROM teams WHERE team_name = $1', [teamName]);
                return result.rows[0] || null;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to get team by name');
            }
        });
    }
}
exports.default = new TeamService();

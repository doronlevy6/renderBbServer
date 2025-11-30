"use strict";
// src/services/balancedTeamsService.ts
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
const userModel_1 = __importDefault(require("../models/userModel"));
class BalancedTeamsService {
    // UPDATED: עדכון השאילתה לשימוש בעמודות החדשות param1 ... param6
    getAllPlayersRankingsFromUser(raterUsername, teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT   
          u.username, 
          COALESCE(AVG(pr.param1), 0) AS param1,
          COALESCE(AVG(pr.param2), 0) AS param2, 
          COALESCE(AVG(pr.param3), 0) AS param3,
          COALESCE(AVG(pr.param4), 0) AS param4, 
          COALESCE(AVG(pr.param5), 0) AS param5,
          COALESCE(AVG(pr.param6), 0) AS param6
        FROM users u
        LEFT JOIN player_rankings pr ON u.username = pr.rated_username AND pr.rater_username = $1
        WHERE u.team_id = $2
        GROUP BY u.username`, [raterUsername, teamId]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error(`Failed to fetch player rankings from rater '${raterUsername}'`);
            }
        });
    }
    // UPDATED: עדכון השאילתה לשימוש במפתחות החדשים
    getAllPlayersRankings(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT   
          u.username, 
          COALESCE(AVG(pr.param1), 0) AS param1,
          COALESCE(AVG(pr.param2), 0) AS param2, 
          COALESCE(AVG(pr.param3), 0) AS param3,
          COALESCE(AVG(pr.param4), 0) AS param4, 
          COALESCE(AVG(pr.param5), 0) AS param5,
          COALESCE(AVG(pr.param6), 0) AS param6
        FROM users u
        LEFT JOIN player_rankings pr ON u.username = pr.rated_username
        WHERE u.team_id = $1
        GROUP BY u.username`, [teamId]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch player rankings for the team');
            }
        });
    }
}
const balancedTeamsService = new BalancedTeamsService();
exports.default = balancedTeamsService;

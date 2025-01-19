"use strict";
// src/services/userService.ts
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
class UserService {
    // יצירת משתמש חדש
    createUser(username, password, email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query('INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING *', [username, password, email]);
                return result.rows[0];
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to create user');
            }
        });
    }
    // התחברות משתמש
    loginUser(username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
                const user = result.rows[0];
                if (user && user.password === password) {
                    // **שים לב:** בשימוש אמיתי, יש להצפין את הסיסמה ולבדוק ערכים מוצפנים.
                    return user;
                }
                else {
                    return null;
                }
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to authenticate user');
            }
        });
    }
    // קבלת כל שמות המשתמשים
    getAllUsernames() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query('SELECT username FROM users ORDER BY username ASC');
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch usernames');
            }
        });
    }
    // אחסון דירוגי שחקנים
    storePlayerRankings(rater_username, rankings) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield userModel_1.default.query('DELETE FROM player_rankings WHERE rater_username = $1', [rater_username]);
                for (let ranking of rankings) {
                    const { username, skillLevel, scoringAbility, defensiveSkills, speedAndAgility, shootingRange, reboundSkills, } = ranking;
                    yield userModel_1.default.query('INSERT INTO player_rankings (rater_username, rated_username, skill_level, scoring_ability, defensive_skills, speed_and_agility, shooting_range, rebound_skills) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
                        rater_username,
                        username,
                        skillLevel,
                        scoringAbility,
                        defensiveSkills,
                        speedAndAgility,
                        shootingRange,
                        reboundSkills,
                    ]);
                }
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to store player rankings');
            }
        });
    }
    // קבלת דירוגי שחקנים לפי משתמש
    getPlayerRankings(username) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query('SELECT * FROM player_rankings WHERE rater_username = $1', [username]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch player rankings');
            }
        });
    }
    // קבלת דירוגי שחקנים לפי מדרג
    getPlayerRankingsByRater(rater_username) {
        return __awaiter(this, void 0, void 0, function* () {
            // ניתן להגדיר ממשק מתאים
            try {
                const result = yield userModel_1.default.query(`SELECT u.username, pr.skill_level, pr.scoring_ability, pr.defensive_skills, pr.speed_and_agility, pr.shooting_range, pr.rebound_skills
         FROM users u
         LEFT JOIN player_rankings pr ON u.username = pr.rated_username AND pr.rater_username = $1`, [rater_username]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch player rankings');
            }
        });
    }
    // קבלת כל המשתמשים הרשומים למשחק הבא
    getAllEnlistedUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query('SELECT username FROM next_game_enlistment ORDER BY enlistment_order ASC');
                return result.rows.map((row) => row.username); // Return an array of usernames
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch enlisted users');
            }
        });
    }
    // מחיקת משתמשים רשומים
    deleteEnlistedUsers(usernames) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield userModel_1.default.query('DELETE FROM next_game_enlistment WHERE username = ANY($1::text[])', [usernames]);
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to delete enlisted users');
            }
        });
    }
    // הרשמה למשתמשים למשחק הבא
    enlistUsersBox(usernames) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield userModel_1.default.connect();
            try {
                yield client.query('BEGIN');
                // Fetch the current maximum enlistment_order
                const res = yield client.query('SELECT COALESCE(MAX(enlistment_order), 0) AS max_order FROM next_game_enlistment');
                let currentOrder = res.rows[0].max_order;
                // Prepare the INSERT query
                const insertQuery = `
        INSERT INTO next_game_enlistment (username, enlistment_order)
        VALUES ($1, $2)
      `;
                for (const username of usernames) {
                    currentOrder += 1;
                    yield client.query(insertQuery, [username, currentOrder]);
                }
                yield client.query('COMMIT');
                return true; // Return true if all inserts were successful
            }
            catch (err) {
                yield client.query('ROLLBACK');
                console.error(err);
                throw new Error('Failed to enlist users for next game');
            }
            finally {
                client.release();
            }
        });
    }
    // קבלת צוותים
    getTeams() {
        return __awaiter(this, void 0, void 0, function* () {
            // ניתן להגדיר ממשק מתאים
            try {
                // Fetch the last row by ordering by game_id in descending order and limiting the result to one row
                const result = yield userModel_1.default.query('SELECT teams FROM game_teams ORDER BY game_id DESC LIMIT 1');
                if (result.rows.length > 0) {
                    return result.rows[0].teams; // Return the teams field from the last row
                }
                else {
                    throw new Error('No teams found');
                }
            }
            catch (err) {
                console.error(err);
                throw err; // Propagate the error to be handled by the caller
            }
        });
    }
}
const userService = new UserService();
exports.default = userService;

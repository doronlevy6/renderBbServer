"use strict";
// הקוד הבא נכתב משמאל לימין
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
    createUser(username_1, password_1, email_1, teamId_1) {
        return __awaiter(this, arguments, void 0, function* (username, password, email, teamId, // NEW: Optional team parameter
        role = 'player' // NEW: Optional role parameter, default to 'player'
        ) {
            try {
                // Check if username already exists
                const existingUser = yield userModel_1.default.query('SELECT username FROM users WHERE username = $1', [username]);
                if (existingUser.rows.length > 0) {
                    throw new Error('Username already exists. Please choose a different one.');
                }
                // Insert new user if username is available
                // Use NULL for empty email to avoid duplicate key constraint violations
                const result = yield userModel_1.default.query('INSERT INTO users (username, password, email, team_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING *', [username, password, email || null, teamId || null, role]);
                return result.rows[0];
            }
            catch (err) {
                console.error(err);
                throw new Error(err.message || 'Failed to create user');
            }
        });
    }
    // התחברות משתמש
    // Backend: עדכון המתודה loginUser לביצוע join עם טבלת teams
    loginUser(username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT users.*, teams.team_type FROM users
       LEFT JOIN teams ON users.team_id = teams.team_id
       WHERE username = $1`, [username]);
                const user = result.rows[0];
                if (user && user.password === password) {
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
    getAllUsernames(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT username FROM users
          WHERE team_id=$1 
          ORDER BY username ASC`, [teamId]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch usernames');
            }
        });
    }
    // קבלת כל המשתמשים (לניהול)
    getAllUsers(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT username, email, password, team_id FROM users
          WHERE team_id=$1 
          ORDER BY username ASC`, [teamId]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch users');
            }
        });
    }
    // אחסון דירוגי שחקנים
    storePlayerRankings(rater_username, rankings, teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Delete existing rankings for the rater
                yield userModel_1.default.query('DELETE FROM player_rankings WHERE rater_username = $1', [rater_username]);
                for (let ranking of rankings) {
                    // UPDATED: destructuring with new param names
                    const { username, param1, // was skillLevel
                    param2, // was scoringAbility
                    param3, // was defensiveSkills
                    param4, // was speedAndAgility
                    param5, // was shootingRange
                    param6, // was reboundSkills
                     } = ranking;
                    yield userModel_1.default.query(
                    // UPDATED: use new column names param1 ... param6
                    'INSERT INTO player_rankings (rater_username, rated_username, param1, param2, param3, param4, param5, param6, team_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
                        rater_username,
                        username,
                        param1,
                        param2,
                        param3,
                        param4,
                        param5,
                        param6,
                        teamId
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
                const result = yield userModel_1.default.query(
                // UPDATED: select returns new param names
                'SELECT * FROM player_rankings WHERE rater_username = $1', [username]);
                return result.rows;
            }
            catch (err) {
                console.error(err);
                throw new Error('Failed to fetch player rankings');
            }
        });
    }
    // קבלת כל המשתמשים הרשומים למשחק הבא
    getAllEnlistedUsers(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield userModel_1.default.query(`SELECT n.username 
       FROM next_game_enlistment n
       JOIN users u ON n.username = u.username
       WHERE u.team_id = $1 
       ORDER BY n.enlistment_order ASC`, [teamId]);
                return result.rows.map((row) => row.username);
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
    enlistUsersBox(usernames, teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield userModel_1.default.connect();
            try {
                yield client.query('BEGIN');
                const res = yield client.query('SELECT COALESCE(MAX(enlistment_order), 0) AS max_order FROM next_game_enlistment');
                let currentOrder = res.rows[0].max_order;
                const insertQuery = `
        INSERT INTO next_game_enlistment (username, enlistment_order, team_id)
        VALUES ($1, $2, $3)
      `;
                for (const username of usernames) {
                    currentOrder += 1;
                    yield client.query(insertQuery, [username, currentOrder, teamId]);
                }
                yield client.query('COMMIT');
                return true;
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
    getAllTeams() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = 'SELECT team_id, team_name FROM teams';
            const result = yield userModel_1.default.query(query);
            return result.rows;
        });
    }
    // מחיקת משתמש (שחקן)
    deleteUser(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield userModel_1.default.connect();
            try {
                yield client.query('BEGIN');
                const cleanUsername = username.trim();
                // Delete from player_rankings (both as rater and rated)
                yield client.query('DELETE FROM player_rankings WHERE rater_username = $1 OR rated_username = $1', [cleanUsername]);
                // Delete from next_game_enlistment
                yield client.query('DELETE FROM next_game_enlistment WHERE username = $1', [cleanUsername]);
                // Delete from users
                yield client.query('DELETE FROM users WHERE username = $1', [cleanUsername]);
                yield client.query('COMMIT');
            }
            catch (err) {
                yield client.query('ROLLBACK');
                console.error(err);
                throw new Error('Failed to delete user');
            }
            finally {
                client.release();
            }
        });
    }
    // עדכון פרטי משתמש (שחקן)
    updateUser(currentUsername, newUsername, newEmail, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield userModel_1.default.connect();
            try {
                yield client.query('BEGIN');
                // Check if username is changing
                if (currentUsername !== newUsername) {
                    // Check if new username already exists
                    const existing = yield client.query('SELECT username FROM users WHERE username = $1', [newUsername]);
                    if (existing.rows.length > 0) {
                        throw new Error('Username already exists');
                    }
                    // Get current user details
                    const currentUserRes = yield client.query('SELECT * FROM users WHERE username = $1', [currentUsername]);
                    if (currentUserRes.rows.length === 0)
                        throw new Error('User not found');
                    const currentUser = currentUserRes.rows[0];
                    // Prepare new values
                    const emailToUse = newEmail !== undefined ? newEmail : currentUser.email;
                    const passwordToUse = newPassword !== undefined ? newPassword : currentUser.password;
                    const teamIdToUse = currentUser.team_id;
                    // Create new user with a temporary unique email to satisfy NOT NULL and UNIQUE constraints
                    const tempEmail = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}@placeholder.com`;
                    const roleToUse = currentUser.role;
                    yield client.query('INSERT INTO users (username, password, email, team_id, role) VALUES ($1, $2, $3, $4, $5)', [newUsername, passwordToUse, tempEmail, teamIdToUse, roleToUse]);
                    // Update dependent tables to point to new user
                    yield client.query('UPDATE player_rankings SET rater_username = $1 WHERE rater_username = $2', [newUsername, currentUsername]);
                    yield client.query('UPDATE player_rankings SET rated_username = $1 WHERE rated_username = $2', [newUsername, currentUsername]);
                    yield client.query('UPDATE next_game_enlistment SET username = $1 WHERE username = $2', [newUsername, currentUsername]);
                    // Delete old user
                    yield client.query('DELETE FROM users WHERE username = $1', [currentUsername]);
                    // Now update the email of the new user to the correct one
                    yield client.query('UPDATE users SET email = $1 WHERE username = $2', [emailToUse, newUsername]);
                    yield client.query('COMMIT');
                    return Object.assign(Object.assign({}, currentUser), { username: newUsername, email: emailToUse, password: passwordToUse });
                }
                else {
                    // Just updating email/password
                    const result = yield client.query('UPDATE users SET email = COALESCE($1, email), password = COALESCE($2, password) WHERE username = $3 RETURNING *', [newEmail, newPassword, currentUsername]);
                    if (result.rows.length === 0) {
                        throw new Error('User not found');
                    }
                    yield client.query('COMMIT');
                    return result.rows[0];
                }
            }
            catch (err) {
                yield client.query('ROLLBACK');
                console.error(err);
                throw new Error(err.message || 'Failed to update user');
            }
            finally {
                client.release();
            }
        });
    }
}
const userService = new UserService();
exports.default = userService;

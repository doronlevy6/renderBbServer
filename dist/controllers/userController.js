"use strict";
// src/controllers/userController.ts
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
const express_1 = __importDefault(require("express"));
const userService_1 = __importDefault(require("../services/userService"));
const balancedTeamsService_1 = __importDefault(require("../services/balancedTeamsService"));
const socket_1 = require("../socket/socket");
const verifyToken_1 = require("./verifyToken");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send('2000');
}));
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, email } = req.body;
    try {
        const user = yield userService_1.default.createUser(username, password, email);
        res.status(201).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const user = yield userService_1.default.loginUser(username, password);
        if (user) {
            const token = jsonwebtoken_1.default.sign({ username: user.username, userEmail: user.email }, process.env.JWT_SECRET, // השתמש במשתנה סביבה
            { expiresIn: '20h' } // Token expires in 20 hours
            );
            res.status(200).json({ success: true, user, token });
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
router.get('/usernames', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const usernames = yield userService_1.default.getAllUsernames();
        res
            .status(200)
            .json({ success: true, usernames: usernames.map((u) => u.username) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/rankings', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rater_username, rankings } = req.body;
    // לוגיקה להוספת רמות
    try {
        // סינון הדירוגים
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
        yield userService_1.default.storePlayerRankings(rater_username, validRankings);
        res.status(200).json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
// router.get(
//   '/all-rankings/:rater_username',
//   async (req: Request<{ rater_username: string }>, res: Response) => {
//     const { rater_username } = req.params;
//     try {
//       const rankings = await userService.getPlayerRankingsByRater(
//         rater_username
//       );
//       res.status(200).json({ success: true, rankings });
//     } catch (err: any) {
//       res.status(500).json({ success: false, message: err.message });
//     }
//   }
// );
router.get('/rankings/:username', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username } = req.params;
    try {
        const rankings = yield userService_1.default.getPlayerRankings(username);
        res.status(200).json({ success: true, rankings });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
// router.post('/set-teams', async (req: Request, res: Response) => {
//   try {
//     const { isTierMethod } = req.body as { isTierMethod: boolean };
//     const teams = await balancedTeamsService.setBalancedTeams(
//       getIo(),
//       isTierMethod
//     );
//     res.status(200).json({ success: true });
//   } catch (err: any) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });
router.get('/enlist', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const usernames = yield userService_1.default.getAllEnlistedUsers();
        res.status(200).json({ success: true, usernames });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/delete-enlist', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { usernames, isTierMethod } = req.body;
        yield userService_1.default.deleteEnlistedUsers(usernames);
        yield balancedTeamsService_1.default.setBalancedTeams((0, socket_1.getIo)(), isTierMethod);
        res.status(200).json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.post('/enlist-users', verifyToken_1.verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { usernames, isTierMethod } = req.body;
        yield userService_1.default.enlistUsersBox(usernames);
        yield balancedTeamsService_1.default.setBalancedTeams((0, socket_1.getIo)(), isTierMethod); // Pass method to function//!
        res.status(200).json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
router.get('/get-teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teams = yield userService_1.default.getTeams();
        res.status(200).json({ success: true, teams });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
// routes.js or your router file
router.get('/players-rankings/:username', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const username = req.params.username;
    try {
        const playersRankings = yield balancedTeamsService_1.default.getAllPlayersRankingsFromUser(username);
        res.status(200).json({ success: true, playersRankings });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
// routes.js or your router file
router.get('/players-rankings', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const playersRankings = yield balancedTeamsService_1.default.getAllPlayersRankings();
        res.status(200).json({ success: true, playersRankings });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}));
exports.default = router;

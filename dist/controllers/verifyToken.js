"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const verifyToken = (req, res, next) => {
    var _a;
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        res
            .status(500)
            .json({ success: false, message: 'Server JWT is not configured.' });
        return;
    }
    const token = (_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
    if (!token) {
        res
            .status(401)
            .json({ success: false, message: 'Access denied. No token provided.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = decoded; // TypeScript כעת יבין את המבנה של `req.user`
        next();
    }
    catch (ex) {
        if ((ex === null || ex === void 0 ? void 0 : ex.name) === 'TokenExpiredError') {
            res.status(401).json({ success: false, message: 'Token expired.' });
            return;
        }
        res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};
exports.verifyToken = verifyToken;

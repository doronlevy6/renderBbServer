"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireManager = void 0;
exports.getAuthUser = getAuthUser;
exports.getTeamId = getTeamId;
exports.getUsername = getUsername;
exports.isManager = isManager;
function getAuthUser(req) {
    const user = req.user;
    return user !== null && user !== void 0 ? user : null;
}
function getTeamId(req) {
    var _a;
    const teamId = (_a = getAuthUser(req)) === null || _a === void 0 ? void 0 : _a.team_id;
    return typeof teamId === 'number' ? teamId : null;
}
function getUsername(req) {
    var _a;
    const username = (_a = getAuthUser(req)) === null || _a === void 0 ? void 0 : _a.username;
    return typeof username === 'string' && username.trim() !== ''
        ? username
        : null;
}
function isManager(req) {
    var _a;
    return ((_a = getAuthUser(req)) === null || _a === void 0 ? void 0 : _a.role) === 'manager';
}
const requireManager = (req, res, next) => {
    if (!isManager(req)) {
        res.status(403).json({
            success: false,
            message: 'Manager access required.',
        });
        return;
    }
    next();
};
exports.requireManager = requireManager;

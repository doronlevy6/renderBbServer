"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authRoutes_1 = require("./user/authRoutes");
const enlistRoutes_1 = require("./user/enlistRoutes");
const rankingsRoutes_1 = require("./user/rankingsRoutes");
const managementRoutes_1 = require("./user/managementRoutes");
const router = express_1.default.Router();
// Authentication and registration functionality.
(0, authRoutes_1.registerAuthRoutes)(router);
// Enlistment lifecycle functionality (join/leave game list).
(0, enlistRoutes_1.registerEnlistRoutes)(router);
// Rankings functionality (submit and retrieve rankings).
(0, rankingsRoutes_1.registerRankingRoutes)(router);
// Team/player management functionality for managers.
(0, managementRoutes_1.registerManagementRoutes)(router);
exports.default = router;

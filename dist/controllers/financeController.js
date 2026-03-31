"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentRoutes_1 = require("./finance/paymentRoutes");
const gameRoutes_1 = require("./finance/gameRoutes");
const reportRoutes_1 = require("./finance/reportRoutes");
const settingsRoutes_1 = require("./finance/settingsRoutes");
const router = express_1.default.Router();
(0, paymentRoutes_1.registerPaymentRoutes)(router);
(0, gameRoutes_1.registerGameRoutes)(router);
(0, reportRoutes_1.registerFinanceReportRoutes)(router);
(0, settingsRoutes_1.registerFinanceSettingsRoutes)(router);
exports.default = router;

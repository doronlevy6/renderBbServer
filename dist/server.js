"use strict";
// src/server.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const userController_1 = __importDefault(require("./controllers/userController")); // Existing routes
const financeController_1 = __importDefault(require("./controllers/financeController")); // NEW: Finance routes
const socket_1 = require("./socket/socket");
const dbInit_1 = __importDefault(require("./dbInit"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 9090;
app.use((0, cors_1.default)()); // Enable CORS
app.use(express_1.default.json());
// Mount Routes
app.use('/', userController_1.default);
app.use('/finance', financeController_1.default); // Base path for finance endpoints
const server = http_1.default.createServer(app);
const io = (0, socket_1.initialize)(server); // Capture the returned io object
// Initialize DB Tables
(0, dbInit_1.default)();
io.on('connection', (socket) => {
    // מומלץ להגדיר טיפוס מדויק ל-socket
    console.log('Client connected');
});
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

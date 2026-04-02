import express, { Router } from 'express';
import { registerAuthRoutes } from './user/authRoutes';
import { registerEnlistRoutes } from './user/enlistRoutes';
import { registerRankingRoutes } from './user/rankingsRoutes';
import { registerManagementRoutes } from './user/managementRoutes';

const router: Router = express.Router();

// Authentication and registration functionality.
registerAuthRoutes(router);

// Enlistment lifecycle functionality (join/leave game list).
registerEnlistRoutes(router);

// Rankings functionality (submit and retrieve rankings).
registerRankingRoutes(router);

// Team/player management functionality for managers.
registerManagementRoutes(router);

export default router;

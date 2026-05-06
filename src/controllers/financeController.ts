import express, { Router } from 'express';
import { registerPaymentRoutes } from './finance/paymentRoutes';
import { registerGameRoutes } from './finance/gameRoutes';
import { registerFinanceReportRoutes } from './finance/reportRoutes';
import { registerFinanceSettingsRoutes } from './finance/settingsRoutes';
import { registerHallRoutes } from './finance/hallRoutes';

const router: Router = express.Router();

registerPaymentRoutes(router);
registerGameRoutes(router);
registerFinanceReportRoutes(router);
registerFinanceSettingsRoutes(router);
registerHallRoutes(router);

export default router;

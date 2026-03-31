"use strict";
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
exports.registerPaymentRoutes = registerPaymentRoutes;
const userModel_1 = __importDefault(require("../../models/userModel"));
const verifyToken_1 = require("../verifyToken");
const emailService_1 = require("../../services/emailService");
function resolveTeamId(req) {
    var _a;
    const teamId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.team_id;
    return typeof teamId === 'number' ? teamId : null;
}
function registerPaymentRoutes(router) {
    router.post('/add-payment', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { username, amount, method, notes, date, client_payment_id } = req.body;
        const team_id = resolveTeamId(req);
        const normalizedClientPaymentId = typeof client_payment_id === 'string' && client_payment_id.trim() !== ''
            ? client_payment_id.trim()
            : null;
        if (!team_id) {
            res
                .status(400)
                .json({ success: false, message: 'Team identification failed' });
            return;
        }
        try {
            if (normalizedClientPaymentId) {
                const existingPayment = yield userModel_1.default.query('SELECT payment_id FROM payments WHERE team_id = $1 AND client_payment_id = $2 LIMIT 1', [team_id, normalizedClientPaymentId]);
                if (existingPayment.rows.length > 0) {
                    res.status(200).json({
                        success: true,
                        message: 'Payment already recorded',
                        duplicate: true,
                    });
                    return;
                }
            }
            const paymentDate = date || new Date();
            const paymentQuery = normalizedClientPaymentId
                ? `
      INSERT INTO payments (username, team_id, amount, method, notes, date, client_payment_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
                : `
      INSERT INTO payments (username, team_id, amount, method, notes, date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
            const paymentValues = normalizedClientPaymentId
                ? [
                    username,
                    team_id,
                    amount,
                    method,
                    notes || '',
                    paymentDate,
                    normalizedClientPaymentId,
                ]
                : [username, team_id, amount, method, notes || '', paymentDate];
            yield userModel_1.default.query(paymentQuery, paymentValues);
            // Send payment confirmation email
            try {
                const userRes = yield userModel_1.default.query('SELECT email FROM users WHERE username = $1 AND team_id = $2 LIMIT 1', [username, team_id]);
                if (userRes.rows.length > 0 && userRes.rows[0].email) {
                    yield (0, emailService_1.sendPaymentConfirmationEmail)(userRes.rows[0].email, username, Number(amount), method, paymentDate);
                }
            }
            catch (emailError) {
                // Log but don't fail the payment if email fails
                console.error('Failed to send payment confirmation email:', emailError);
            }
            res
                .status(200)
                .json({ success: true, message: 'Payment recorded successfully' });
        }
        catch (error) {
            if (normalizedClientPaymentId && (error === null || error === void 0 ? void 0 : error.code) === '23505') {
                try {
                    const duplicatePayment = yield userModel_1.default.query('SELECT payment_id FROM payments WHERE team_id = $1 AND client_payment_id = $2 LIMIT 1', [team_id, normalizedClientPaymentId]);
                    if (duplicatePayment.rows.length > 0) {
                        res.status(200).json({
                            success: true,
                            message: 'Payment already recorded',
                            duplicate: true,
                        });
                        return;
                    }
                }
                catch (lookupError) {
                    console.error('Error resolving duplicate payment replay:', lookupError);
                }
            }
            console.error('Error adding payment:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }));
    router.delete('/delete-payment/:payment_id', verifyToken_1.verifyToken, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { payment_id } = req.params;
        const team_id = resolveTeamId(req);
        if (!team_id) {
            res
                .status(400)
                .json({ success: false, message: 'Team identification failed' });
            return;
        }
        try {
            const deleteResult = yield userModel_1.default.query('DELETE FROM payments WHERE payment_id = $1 AND team_id = $2', [payment_id, team_id]);
            if (deleteResult.rowCount === 0) {
                res.status(200).json({
                    success: true,
                    message: 'Payment already deleted',
                    alreadyDeleted: true,
                });
                return;
            }
            res.status(200).json({ success: true, message: 'Payment deleted' });
        }
        catch (error) {
            console.error('Error deleting payment:', error);
            res
                .status(500)
                .json({ success: false, message: 'Internal server error' });
        }
    }));
}

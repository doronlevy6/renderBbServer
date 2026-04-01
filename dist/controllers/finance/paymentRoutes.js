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
const crypto_1 = require("crypto");
const userModel_1 = __importDefault(require("../../models/userModel"));
const verifyToken_1 = require("../verifyToken");
const emailService_1 = require("../../services/emailService");
const authz_1 = require("../authz");
const socket_1 = require("../../socket/socket");
function registerPaymentRoutes(router) {
    // Payment creation is restricted to managers only.
    router.post('/add-payment', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const traceId = (0, crypto_1.randomUUID)();
        const { username, amount, method, notes, date, client_payment_id } = req.body;
        const team_id = (0, authz_1.getTeamId)(req);
        const normalizedClientPaymentId = typeof client_payment_id === 'string' && client_payment_id.trim() !== ''
            ? client_payment_id.trim()
            : null;
        if (!team_id) {
            res
                .status(400)
                .json({ success: false, message: 'Team identification failed', trace_id: traceId });
            return;
        }
        try {
            console.log(`[payments:add][${traceId}] team=${team_id} username=${username} amount=${amount} method=${method} clientPaymentId=${normalizedClientPaymentId || 'none'}`);
            const userRes = yield userModel_1.default.query('SELECT email FROM users WHERE username = $1 AND team_id = $2 LIMIT 1', [username, team_id]);
            if (userRes.rows.length === 0) {
                res.status(404).json({ success: false, message: 'Player not found in team', trace_id: traceId });
                return;
            }
            if (normalizedClientPaymentId) {
                const existingPayment = yield userModel_1.default.query('SELECT payment_id FROM payments WHERE team_id = $1 AND client_payment_id = $2 LIMIT 1', [team_id, normalizedClientPaymentId]);
                if (existingPayment.rows.length > 0) {
                    console.log(`[payments:add][${traceId}] duplicate skipped team=${team_id} username=${username} clientPaymentId=${normalizedClientPaymentId}`);
                    res.status(200).json({
                        success: true,
                        message: 'Payment already recorded',
                        duplicate: true,
                        trace_id: traceId,
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
            console.log(`[payments:add][${traceId}] inserted team=${team_id} username=${username} amount=${amount} method=${method}`);
            (0, socket_1.emitToTeam)(team_id, 'financeSummaryUpdated', {
                team_id,
                username,
                source: 'add-payment',
                at: new Date().toISOString(),
            });
            // Send payment confirmation email
            let emailStatus = 'skipped';
            let emailReason = null;
            try {
                const emailResult = yield (0, emailService_1.sendPaymentConfirmationEmail)(userRes.rows[0].email, username, Number(amount), method, paymentDate);
                emailStatus = emailResult.sent
                    ? 'sent'
                    : emailResult.attempted
                        ? 'failed'
                        : 'skipped';
                emailReason = emailResult.reason || null;
                console.log(`[payments:add][${traceId}] email status team=${team_id} username=${username} status=${emailStatus}${emailReason ? ` reason=${emailReason}` : ''}`);
            }
            catch (emailError) {
                // Log but don't fail the payment if email fails
                console.error(`[payments:add][${traceId}] Failed to send payment confirmation email:`, emailError);
                emailStatus = 'failed';
                emailReason = 'send_failed';
            }
            res
                .status(200)
                .json({
                success: true,
                message: 'Payment recorded successfully',
                email_status: emailStatus,
                email_reason: emailReason,
                trace_id: traceId,
            });
        }
        catch (error) {
            console.error(`[payments:add][${traceId}] failed team=${team_id} username=${username} amount=${amount} method=${method}`, error);
            if (normalizedClientPaymentId && (error === null || error === void 0 ? void 0 : error.code) === '23505') {
                try {
                    const duplicatePayment = yield userModel_1.default.query('SELECT payment_id FROM payments WHERE team_id = $1 AND client_payment_id = $2 LIMIT 1', [team_id, normalizedClientPaymentId]);
                    if (duplicatePayment.rows.length > 0) {
                        res.status(200).json({
                            success: true,
                            message: 'Payment already recorded',
                            duplicate: true,
                            trace_id: traceId,
                        });
                        return;
                    }
                }
                catch (lookupError) {
                    console.error(`[payments:add][${traceId}] Error resolving duplicate payment replay:`, lookupError);
                }
            }
            console.error(`[payments:add][${traceId}] Error adding payment:`, error);
            res.status(500).json({ success: false, message: 'Internal server error', trace_id: traceId });
        }
    }));
    router.delete('/delete-payment/:payment_id', verifyToken_1.verifyToken, authz_1.requireManager, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { payment_id } = req.params;
        const team_id = (0, authz_1.getTeamId)(req);
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
            (0, socket_1.emitToTeam)(team_id, 'financeSummaryUpdated', {
                team_id,
                payment_id,
                source: 'delete-payment',
                at: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Error deleting payment:', error);
            res
                .status(500)
                .json({ success: false, message: 'Internal server error' });
        }
    }));
}

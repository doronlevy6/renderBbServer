import { Request, Response, Router } from 'express';
import pool from '../../models/userModel';
import { verifyToken } from '../verifyToken';
import { sendPaymentConfirmationEmail } from '../../services/emailService';
import { getTeamId, requireManager } from '../authz';

export function registerPaymentRoutes(router: Router): void {
  // Payment creation is restricted to managers only.
  router.post('/add-payment', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { username, amount, method, notes, date, client_payment_id } = req.body;
    const team_id = getTeamId(req);
    const normalizedClientPaymentId =
      typeof client_payment_id === 'string' && client_payment_id.trim() !== ''
        ? client_payment_id.trim()
        : null;

    if (!team_id) {
      res
        .status(400)
        .json({ success: false, message: 'Team identification failed' });
      return;
    }

    try {
      const userRes = await pool.query(
        'SELECT email FROM users WHERE username = $1 AND team_id = $2 LIMIT 1',
        [username, team_id]
      );
      if (userRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Player not found in team' });
        return;
      }

      if (normalizedClientPaymentId) {
        const existingPayment = await pool.query(
          'SELECT payment_id FROM payments WHERE team_id = $1 AND client_payment_id = $2 LIMIT 1',
          [team_id, normalizedClientPaymentId]
        );

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

      await pool.query(paymentQuery, paymentValues);

      // Send payment confirmation email
      let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
      let emailReason:
        | 'smtp_not_configured'
        | 'missing_recipient_email'
        | 'send_failed'
        | null = null;
      try {
        const emailResult = await sendPaymentConfirmationEmail(
          userRes.rows[0].email,
          username,
          Number(amount),
          method,
          paymentDate
        );
        emailStatus = emailResult.sent
          ? 'sent'
          : emailResult.attempted
          ? 'failed'
          : 'skipped';
        emailReason = emailResult.reason || null;
      } catch (emailError) {
        // Log but don't fail the payment if email fails
        console.error('Failed to send payment confirmation email:', emailError);
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
        });
    } catch (error: any) {
      if (normalizedClientPaymentId && error?.code === '23505') {
        try {
          const duplicatePayment = await pool.query(
            'SELECT payment_id FROM payments WHERE team_id = $1 AND client_payment_id = $2 LIMIT 1',
            [team_id, normalizedClientPaymentId]
          );

          if (duplicatePayment.rows.length > 0) {
            res.status(200).json({
              success: true,
              message: 'Payment already recorded',
              duplicate: true,
            });
            return;
          }
        } catch (lookupError) {
          console.error('Error resolving duplicate payment replay:', lookupError);
        }
      }

      console.error('Error adding payment:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.delete(
    '/delete-payment/:payment_id',
    verifyToken,
    requireManager,
    async (req: Request, res: Response) => {
      const { payment_id } = req.params;
      const team_id = getTeamId(req);

      if (!team_id) {
        res
          .status(400)
          .json({ success: false, message: 'Team identification failed' });
        return;
      }

      try {
        const deleteResult = await pool.query(
          'DELETE FROM payments WHERE payment_id = $1 AND team_id = $2',
          [payment_id, team_id]
        );

        if (deleteResult.rowCount === 0) {
          res.status(200).json({
            success: true,
            message: 'Payment already deleted',
            alreadyDeleted: true,
          });
          return;
        }

        res.status(200).json({ success: true, message: 'Payment deleted' });
      } catch (error) {
        console.error('Error deleting payment:', error);
        res
          .status(500)
          .json({ success: false, message: 'Internal server error' });
      }
    }
  );
}

import { Request, Response, Router } from 'express';
import pool from '../../models/userModel';
import { verifyToken } from '../verifyToken';
import { getTeamId, requireManager } from '../authz';
import { emitToTeam } from '../../socket/socket';

const DEFAULT_HALL_GAME_COST = 200;
const DEFAULT_TRACKING_START_DATE = '2025-10-05';
const DEFAULT_OPENING_NOTE =
  'Paid 4000 on 2025-09-11, covered through 2025-10-04';

interface HallGameRow {
  hall_game_id: number;
  game_id: number | null;
  game_date: string;
  cost: number;
  source: string;
  notes: string;
}

interface HallPaymentRow {
  hall_payment_id: number;
  amount: number;
  date: string;
  notes: string;
}

function normalizeDateOnly(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const monthNumber = parseInt(dotMatch[2], 10);
    const month = String(monthNumber).padStart(2, '0');
    let year = dotMatch[3] || (monthNumber >= 10 ? '2025' : '2026');
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function toInt(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function ensureHallSettings(teamId: number): Promise<any> {
  const teamRes = await pool.query(
    'SELECT team_id FROM teams WHERE team_id = $1',
    [teamId]
  );
  if (teamRes.rows.length === 0) {
    const error: any = new Error('Team not found. Please log out and log in again.');
    error.statusCode = 401;
    throw error;
  }

  const result = await pool.query(
    `
      INSERT INTO hall_settings (
        team_id,
        default_game_cost,
        tracking_start_date,
        opening_note
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (team_id) DO NOTHING
      RETURNING team_id, default_game_cost, tracking_start_date, opening_note
    `,
    [
      teamId,
      DEFAULT_HALL_GAME_COST,
      DEFAULT_TRACKING_START_DATE,
      DEFAULT_OPENING_NOTE,
    ]
  );

  if (result.rows.length > 0) return result.rows[0];

  const existing = await pool.query(
    `
      SELECT team_id, default_game_cost, tracking_start_date, opening_note
      FROM hall_settings
      WHERE team_id = $1
    `,
    [teamId]
  );
  return existing.rows[0];
}

function sendHallError(res: Response, error: any, fallbackMessage: string): void {
  const statusCode = error?.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : error.message || fallbackMessage,
  });
}

function buildHallSummary(
  settings: any,
  games: HallGameRow[],
  payments: HallPaymentRow[]
) {
  const defaultGameCost = toInt(settings.default_game_cost, DEFAULT_HALL_GAME_COST);
  const totalGameCost = games.reduce(
    (sum, game) => sum + toInt(game.cost, 0),
    0
  );
  const totalPaid = payments.reduce(
    (sum, payment) => sum + toInt(payment.amount, 0),
    0
  );
  const balance = totalPaid - totalGameCost;
  const gamesRemaining =
    defaultGameCost > 0 && balance > 0 ? Math.floor(balance / defaultGameCost) : 0;
  const gamesOwed =
    defaultGameCost > 0 && balance < 0
      ? Math.ceil(Math.abs(balance) / defaultGameCost)
      : 0;

  let remainingPaid = totalPaid;
  let coveredThroughDate: string | null = null;
  let nextUncoveredGameDate: string | null = null;
  let coveredGamesCount = 0;

  for (const game of games) {
    const cost = toInt(game.cost, 0);
    if (remainingPaid >= cost) {
      remainingPaid -= cost;
      coveredThroughDate = game.game_date;
      coveredGamesCount += 1;
    } else {
      nextUncoveredGameDate = game.game_date;
      break;
    }
  }

  return {
    defaultGameCost,
    gameCount: games.length,
    paymentCount: payments.length,
    totalGameCost,
    totalPaid,
    balance,
    gamesRemaining,
    gamesOwed,
    coveredGamesCount,
    coveredThroughDate,
    nextUncoveredGameDate,
  };
}

export function registerHallRoutes(router: Router): void {
  router.get('/hall/summary', verifyToken, requireManager, async (req: Request, res: Response) => {
    const teamId = getTeamId(req);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    try {
      const settings = await ensureHallSettings(teamId);
      const gamesRes = await pool.query(
        `
          SELECT hall_game_id, game_id, game_date, cost, source, notes
          FROM hall_games
          WHERE team_id = $1
          ORDER BY game_date ASC, hall_game_id ASC
        `,
        [teamId]
      );
      const paymentsRes = await pool.query(
        `
          SELECT hall_payment_id, amount, date, notes
          FROM hall_payments
          WHERE team_id = $1
          ORDER BY date ASC, hall_payment_id ASC
        `,
        [teamId]
      );
      const unsyncedGamesRes = await pool.query(
        `
          SELECT COUNT(*) AS count
          FROM games g
          WHERE g.team_id = $1
            AND g.date::date >= $2::date
            AND NOT EXISTS (
              SELECT 1
              FROM hall_games hg
              WHERE hg.team_id = g.team_id
                AND (hg.game_id = g.game_id OR hg.game_date = g.date::date)
            )
        `,
        [teamId, settings.tracking_start_date]
      );

      const games = gamesRes.rows as HallGameRow[];
      const payments = paymentsRes.rows as HallPaymentRow[];
      const summary = buildHallSummary(settings, games, payments);
      const unsyncedSavedGameCount = toInt(
        unsyncedGamesRes.rows[0]?.count,
        0
      );

      res.status(200).json({
        success: true,
        settings,
        summary: {
          ...summary,
          unsyncedSavedGameCount,
          unsyncedSavedGameCost:
            unsyncedSavedGameCount * summary.defaultGameCost,
        },
        games,
        payments,
      });
    } catch (error: any) {
      console.error('Error fetching hall summary:', error);
      sendHallError(res, error, 'Failed to fetch hall summary');
    }
  });

  router.put('/hall/settings', verifyToken, requireManager, async (req: Request, res: Response) => {
    const teamId = getTeamId(req);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    const defaultGameCost = Math.max(
      0,
      toInt(req.body.default_game_cost, DEFAULT_HALL_GAME_COST)
    );
    const trackingStartDate =
      normalizeDateOnly(req.body.tracking_start_date) || DEFAULT_TRACKING_START_DATE;
    const openingNote =
      typeof req.body.opening_note === 'string'
        ? req.body.opening_note.trim()
        : DEFAULT_OPENING_NOTE;

    try {
      const result = await pool.query(
        `
          INSERT INTO hall_settings (
            team_id,
            default_game_cost,
            tracking_start_date,
            opening_note,
            updated_at
          )
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (team_id)
          DO UPDATE SET
            default_game_cost = EXCLUDED.default_game_cost,
            tracking_start_date = EXCLUDED.tracking_start_date,
            opening_note = EXCLUDED.opening_note,
            updated_at = CURRENT_TIMESTAMP
          RETURNING team_id, default_game_cost, tracking_start_date, opening_note
        `,
        [teamId, defaultGameCost, trackingStartDate, openingNote]
      );

      emitToTeam(teamId, 'financeSummaryUpdated', {
        team_id: teamId,
        source: 'hall-settings',
        at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: 'Hall settings updated',
        settings: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error updating hall settings:', error);
      sendHallError(res, error, 'Failed to update hall settings');
    }
  });

  router.post('/hall/sync-games', verifyToken, requireManager, async (req: Request, res: Response) => {
    const teamId = getTeamId(req);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    try {
      const settings = await ensureHallSettings(teamId);
      const result = await pool.query(
        `
          WITH saved_games AS (
            SELECT DISTINCT ON (g.team_id, g.date::date)
              g.team_id,
              g.game_id,
              g.date::date AS game_date,
              COALESCE(g.notes, '') AS notes
            FROM games g
            WHERE g.team_id = $1
              AND g.date::date >= $3::date
            ORDER BY g.team_id, g.date::date, g.date ASC, g.game_id ASC
          ),
          linked AS (
            UPDATE hall_games hg
            SET game_id = sg.game_id,
                source = 'saved_game',
                notes = CASE
                  WHEN COALESCE(hg.notes, '') = '' THEN sg.notes
                  ELSE hg.notes
                END,
                updated_at = CURRENT_TIMESTAMP
            FROM saved_games sg
            WHERE hg.team_id = sg.team_id
              AND hg.game_date = sg.game_date
              AND hg.game_id IS NULL
            RETURNING hg.hall_game_id
          ),
          inserted AS (
            INSERT INTO hall_games (team_id, game_id, game_date, cost, source, notes)
            SELECT sg.team_id, sg.game_id, sg.game_date, $2, 'saved_game', sg.notes
            FROM saved_games sg
            WHERE NOT EXISTS (
              SELECT 1
              FROM hall_games hg
              WHERE hg.team_id = sg.team_id
                AND (hg.game_id = sg.game_id OR hg.game_date = sg.game_date)
            )
            ORDER BY sg.game_date ASC
            RETURNING hall_game_id
          )
          SELECT
            (SELECT COUNT(*) FROM linked) AS linked_count,
            (SELECT COUNT(*) FROM inserted) AS inserted_count
        `,
        [teamId, settings.default_game_cost, settings.tracking_start_date]
      );

      const linked = parseInt(result.rows[0]?.linked_count || '0', 10);
      const inserted = parseInt(result.rows[0]?.inserted_count || '0', 10);

      emitToTeam(teamId, 'financeSummaryUpdated', {
        team_id: teamId,
        source: 'hall-sync-games',
        inserted,
        linked,
        at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: 'Saved games synced',
        inserted,
        linked,
      });
    } catch (error: any) {
      console.error('Error syncing hall games:', error);
      sendHallError(res, error, 'Failed to sync hall games');
    }
  });

  router.post('/hall/import-dates', verifyToken, requireManager, async (req: Request, res: Response) => {
    const teamId = getTeamId(req);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    const rawDates = Array.isArray(req.body.dates) ? req.body.dates : [];
    const dates = Array.from(
      new Set(rawDates.map(normalizeDateOnly).filter(Boolean) as string[])
    );

    if (dates.length === 0) {
      res.status(400).json({ success: false, message: 'No valid dates provided' });
      return;
    }

    try {
      const settings = await ensureHallSettings(teamId);
      const result = await pool.query(
        `
          INSERT INTO hall_games (team_id, game_date, cost, source, notes)
          SELECT $1, unnest($2::date[]), $3, 'manual_import', $4
          ON CONFLICT (team_id, game_date) DO NOTHING
          RETURNING hall_game_id
        `,
        [teamId, dates, settings.default_game_cost, req.body.notes || 'Manual import']
      );

      emitToTeam(teamId, 'financeSummaryUpdated', {
        team_id: teamId,
        source: 'hall-import-dates',
        inserted: result.rows.length,
        at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: 'Hall dates imported',
        inserted: result.rows.length,
        skipped: dates.length - result.rows.length,
      });
    } catch (error: any) {
      console.error('Error importing hall dates:', error);
      sendHallError(res, error, 'Failed to import hall dates');
    }
  });

  router.post('/hall/payments', verifyToken, requireManager, async (req: Request, res: Response) => {
    const teamId = getTeamId(req);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    const amount = toInt(req.body.amount, 0);
    const date = normalizeDateOnly(req.body.date) || new Date().toISOString().split('T')[0];
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

    if (amount <= 0) {
      res.status(400).json({ success: false, message: 'Payment amount must be positive' });
      return;
    }

    try {
      const result = await pool.query(
        `
          INSERT INTO hall_payments (team_id, amount, date, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING hall_payment_id, amount, date, notes
        `,
        [teamId, amount, date, notes]
      );

      emitToTeam(teamId, 'financeSummaryUpdated', {
        team_id: teamId,
        source: 'hall-payment',
        at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: 'Hall payment recorded',
        payment: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error adding hall payment:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.delete('/hall/payments/:hall_payment_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const teamId = getTeamId(req);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    try {
      const result = await pool.query(
        'DELETE FROM hall_payments WHERE hall_payment_id = $1 AND team_id = $2',
        [req.params.hall_payment_id, teamId]
      );

      emitToTeam(teamId, 'financeSummaryUpdated', {
        team_id: teamId,
        source: 'hall-payment-delete',
        at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: result.rowCount === 0 ? 'Payment already deleted' : 'Payment deleted',
      });
    } catch (error: any) {
      console.error('Error deleting hall payment:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.put('/hall/games/:hall_game_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const teamId = getTeamId(req);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    const cost = Math.max(0, toInt(req.body.cost, 0));
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : null;

    try {
      const result = await pool.query(
        `
          UPDATE hall_games
          SET cost = $1,
              notes = COALESCE($2, notes),
              updated_at = CURRENT_TIMESTAMP
          WHERE hall_game_id = $3 AND team_id = $4
          RETURNING hall_game_id, game_id, game_date, cost, source, notes
        `,
        [cost, notes, req.params.hall_game_id, teamId]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ success: false, message: 'Hall game not found' });
        return;
      }

      emitToTeam(teamId, 'financeSummaryUpdated', {
        team_id: teamId,
        source: 'hall-game-update',
        at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: 'Hall game updated',
        game: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error updating hall game:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
}

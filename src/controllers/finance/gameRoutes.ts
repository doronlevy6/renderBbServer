import { Request, Response, Router } from 'express';
import pool from '../../models/userModel';
import { verifyToken } from '../verifyToken';
import { getTeamId, requireManager } from '../authz';
import { emitToTeam } from '../../socket/socket';

const toOptionalInt = (value: any): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildGameSessionId = (date: any, time: any): string | null => {
  if (!date || !time) return null;
  const dateOnly = String(date).split('T')[0];
  return `${dateOnly}_${time}`;
};

const emitFinanceUpdate = (
  teamId: number,
  payload: Record<string, any>
): void => {
  emitToTeam(teamId, 'financeSummaryUpdated', {
    team_id: teamId,
    ...payload,
    at: new Date().toISOString(),
  });
};

export function registerGameRoutes(router: Router): void {
  // Game recording is restricted to managers only.
  router.post('/record-game', verifyToken, requireManager, async (req: Request, res: Response) => {
    const {
      date,
      time,
      enlistedPlayers,
      base_cost,
      notes,
      hall_cost,
      force_base_cost,
      specific_player_costs,
      specific_player_notes,
    } = req.body;
    const team_id = getTeamId(req);

    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    try {
      // 1. Generate game_session_id from date and time
      let gameSessionId: string | null = null;
      if (date && time) {
        const dateOnly = date.split('T')[0]; // Ensure we only have YYYY-MM-DD
        gameSessionId = `${dateOnly}_${time}`;
      }

      // 2. Get Team Default Cost if not provided
      let costPerGame = base_cost;
      if (costPerGame === undefined || costPerGame === null) {
        const teamRes = await pool.query('SELECT default_game_cost FROM teams WHERE team_id = $1', [team_id]);
        if (teamRes.rows.length === 0) {
          res.status(404).json({ success: false, message: 'Team not found' });
          return;
        }
        costPerGame = teamRes.rows[0].default_game_cost || 0;
      }

      let gameId: number;
      let gameDateForHall = date || new Date();
      const parsedHallCost =
        hall_cost === undefined || hall_cost === null || hall_cost === ''
          ? null
          : parseInt(String(hall_cost), 10);
      const hallCostOverride =
        parsedHallCost !== null && Number.isFinite(parsedHallCost)
          ? Math.max(0, parsedHallCost)
          : null;

      // 3. Check if Game Session Already Exists
      if (gameSessionId) {
        const existingGameRes = await pool.query(
          'SELECT game_id, date FROM games WHERE game_session_id = $1 AND team_id = $2',
          [gameSessionId, team_id]
        );

        if (existingGameRes.rows.length > 0) {
          // Game session exists, use existing game_id
          gameId = existingGameRes.rows[0].game_id;
          gameDateForHall = existingGameRes.rows[0].date;
          console.log(`Adding players to existing game session: ${gameSessionId}`);
        } else {
          // Create new game session
          const gameQuery = `
                    INSERT INTO games (team_id, date, base_cost, notes, game_session_id)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING game_id
                `;
          const gameValues = [team_id, date || new Date(), costPerGame, notes || '', gameSessionId];
          const gameResult = await pool.query(gameQuery, gameValues);
          gameId = gameResult.rows[0].game_id;
          gameDateForHall = gameValues[1];
          console.log(`Created new game session: ${gameSessionId}`);
        }
      } else {
        // No session ID provided, create game without it (backward compatibility)
        const gameQuery = `
                INSERT INTO games (team_id, date, base_cost, notes)
                VALUES ($1, $2, $3, $4)
                RETURNING game_id
            `;
        const gameValues = [team_id, date || new Date(), costPerGame, notes || ''];
        const gameResult = await pool.query(gameQuery, gameValues);
        gameId = gameResult.rows[0].game_id;
        gameDateForHall = gameValues[1];
      }

      await pool.query(
        `
          WITH settings AS (
            INSERT INTO hall_settings (
              team_id,
              default_game_cost,
              tracking_start_date,
              opening_note
            )
            VALUES (
              $1,
              200,
              '2025-10-05',
              'Paid 4000 on 2025-09-11, covered through 2025-10-04'
            )
            ON CONFLICT (team_id) DO UPDATE
              SET updated_at = hall_settings.updated_at
            RETURNING default_game_cost
          )
          INSERT INTO hall_games (team_id, game_id, game_date, cost, source, notes)
          VALUES (
            $1,
            $2,
            $3::date,
            COALESCE($4, (SELECT default_game_cost FROM settings), 200),
            'saved_game',
            $5
          )
          ON CONFLICT (team_id, game_date)
          DO UPDATE SET
            game_id = COALESCE(hall_games.game_id, EXCLUDED.game_id),
            source = 'saved_game',
            cost = CASE
              WHEN $4::int IS NULL THEN hall_games.cost
              ELSE EXCLUDED.cost
            END,
            notes = CASE
              WHEN COALESCE(hall_games.notes, '') = '' THEN EXCLUDED.notes
              ELSE hall_games.notes
            END,
            updated_at = CURRENT_TIMESTAMP
        `,
        [team_id, gameId, gameDateForHall, hallCostOverride, notes || '']
      );

      // 4. Create Attendance Records
      if (enlistedPlayers && enlistedPlayers.length > 0) {
        for (const username of enlistedPlayers) {
          // Check if player already exists in this game session
          const existingAttendance = await pool.query(
            'SELECT attendance_id FROM game_attendance WHERE game_id = $1 AND username = $2',
            [gameId, username]
          );

          if (existingAttendance.rows.length > 0) {
            console.log(`Player ${username} already in game session, skipping...`);
            continue;
          }

          let playerCost = costPerGame;
          const adjustmentNote = specific_player_notes?.[username] || '';

          // Priority 1: Specific ad-hoc override from the Save Dialog
          if (specific_player_costs && specific_player_costs[username] !== undefined && specific_player_costs[username] !== null) {
            playerCost = specific_player_costs[username];
          }
          // Priority 2: Force Base Cost (Apply to All)
          else if (force_base_cost) {
            playerCost = costPerGame;
          }
          // Priority 3: Custom Player Settings
          else {
            const userRes = await pool.query(
              'SELECT custom_game_cost FROM users WHERE username = $1 AND team_id = $2',
              [username, team_id]
            );
            if (userRes.rows.length > 0 && userRes.rows[0].custom_game_cost !== null) {
              playerCost = userRes.rows[0].custom_game_cost;
            }
          }

          await pool.query(
            `
          INSERT INTO game_attendance (game_id, username, applied_cost, adjustment_note)
          VALUES ($1, $2, $3, $4)
        `,
            [gameId, username, playerCost, adjustmentNote]
          );
        }
      }

      emitFinanceUpdate(team_id, {
        game_id: gameId,
        game_session_id: gameSessionId,
        source: 'record-game',
      });

      res.status(200).json({ success: true, message: 'Game recorded successfully', gameId, gameSessionId });
    } catch (error: any) {
      console.error('Error recording game:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.delete('/delete-attendance/:attendance_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { attendance_id } = req.params;
    const team_id = getTeamId(req);
    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }
    try {
      const deleteRes = await pool.query(
        `
          DELETE FROM game_attendance ga
          USING games g
          WHERE ga.attendance_id = $1
            AND ga.game_id = g.game_id
            AND g.team_id = $2
        `,
        [attendance_id, team_id]
      );
      if (deleteRes.rowCount === 0) {
        res.status(404).json({ success: false, message: 'Attendance record not found' });
        return;
      }
      emitFinanceUpdate(team_id, {
        attendance_id,
        source: 'delete-attendance',
      });

      res.status(200).json({ success: true, message: 'Game record deleted for player' });
    } catch (error: any) {
      console.error('Error deleting attendance:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.put('/game-sessions/:game_session_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { game_session_id } = req.params;
    const team_id = getTeamId(req);
    const { date, time, base_cost, notes, hall_cost } = req.body;

    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    const baseCost = toOptionalInt(base_cost);
    const hallCost = toOptionalInt(hall_cost);
    const nextSessionId = buildGameSessionId(date, time);
    const nextDate = date || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentGameRes = await client.query(
        'SELECT game_id, date, base_cost, notes, game_session_id FROM games WHERE game_session_id = $1 AND team_id = $2 FOR UPDATE',
        [game_session_id, team_id]
      );

      if (currentGameRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ success: false, message: 'Game session not found' });
        return;
      }

      const currentGame = currentGameRes.rows[0];
      const targetSessionId = nextSessionId || currentGame.game_session_id;

      if (targetSessionId !== currentGame.game_session_id) {
        const conflictRes = await client.query(
          'SELECT game_id FROM games WHERE game_session_id = $1 AND game_id <> $2',
          [targetSessionId, currentGame.game_id]
        );
        if (conflictRes.rows.length > 0) {
          await client.query('ROLLBACK');
          res.status(409).json({
            success: false,
            duplicate: true,
            message: 'Another game already uses this date and time',
          });
          return;
        }
      }

      const updateGameRes = await client.query(
        `
          UPDATE games
          SET
            date = COALESCE($1::timestamp, date),
            base_cost = COALESCE($2::int, base_cost),
            notes = COALESCE($3::text, notes),
            game_session_id = $4
          WHERE game_id = $5 AND team_id = $6
          RETURNING game_id, game_session_id, date, base_cost, notes
        `,
        [
          nextDate,
          baseCost,
          notes === undefined ? null : String(notes),
          targetSessionId,
          currentGame.game_id,
          team_id,
        ]
      );

      if (nextDate || hallCost !== null || notes !== undefined) {
        await client.query(
          `
            UPDATE hall_games
            SET
              game_date = COALESCE($1::date, game_date),
              cost = COALESCE($2::int, cost),
              notes = CASE
                WHEN $3::text IS NULL THEN notes
                ELSE $3::text
              END,
              updated_at = CURRENT_TIMESTAMP
            WHERE team_id = $4 AND game_id = $5
          `,
          [
            nextDate,
            hallCost,
            notes === undefined ? null : String(notes),
            team_id,
            currentGame.game_id,
          ]
        );
      }

      await client.query('COMMIT');

      const game = updateGameRes.rows[0];
      emitFinanceUpdate(team_id, {
        game_id: game.game_id,
        game_session_id: game.game_session_id,
        source: 'game-session-update',
      });

      res.status(200).json({
        success: true,
        message: 'Game session updated',
        game,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error updating game session:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
      client.release();
    }
  });

  router.post('/game-sessions/:game_session_id/players', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { game_session_id } = req.params;
    const team_id = getTeamId(req);
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const appliedCostInput = toOptionalInt(req.body.applied_cost);
    const adjustmentNote = req.body.adjustment_note === undefined
      ? ''
      : String(req.body.adjustment_note);

    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }
    if (!username) {
      res.status(400).json({ success: false, message: 'Player is required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const gameRes = await client.query(
        'SELECT game_id, base_cost FROM games WHERE game_session_id = $1 AND team_id = $2 FOR UPDATE',
        [game_session_id, team_id]
      );
      if (gameRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ success: false, message: 'Game session not found' });
        return;
      }

      const userRes = await client.query(
        'SELECT username, custom_game_cost FROM users WHERE username = $1 AND team_id = $2',
        [username, team_id]
      );
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ success: false, message: 'Player not found in team' });
        return;
      }

      const game = gameRes.rows[0];
      const existingRes = await client.query(
        'SELECT attendance_id FROM game_attendance WHERE game_id = $1 AND username = $2',
        [game.game_id, username]
      );
      if (existingRes.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({
          success: false,
          duplicate: true,
          message: 'Player already exists in this game session',
        });
        return;
      }

      const defaultCost = userRes.rows[0].custom_game_cost ?? game.base_cost ?? 0;
      const appliedCost = appliedCostInput ?? defaultCost;
      const insertRes = await client.query(
        `
          INSERT INTO game_attendance (game_id, username, applied_cost, adjustment_note)
          VALUES ($1, $2, $3, $4)
          RETURNING attendance_id, username, applied_cost, adjustment_note
        `,
        [game.game_id, username, appliedCost, adjustmentNote]
      );

      await client.query('COMMIT');

      emitFinanceUpdate(team_id, {
        game_id: game.game_id,
        game_session_id,
        username,
        source: 'game-session-add-player',
      });

      res.status(201).json({
        success: true,
        message: 'Player added to game session',
        player: insertRes.rows[0],
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error adding player to game session:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
      client.release();
    }
  });

  router.put('/game-attendance/:attendance_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { attendance_id } = req.params;
    const team_id = getTeamId(req);
    const appliedCost = toOptionalInt(req.body.applied_cost);
    const adjustmentNote = req.body.adjustment_note === undefined
      ? null
      : String(req.body.adjustment_note);

    if (!team_id) {
      res.status(400).json({ success: false, message: 'Team identification failed' });
      return;
    }

    if (appliedCost === null && adjustmentNote === null) {
      res.status(400).json({ success: false, message: 'No changes provided' });
      return;
    }

    try {
      const updateRes = await pool.query(
        `
          UPDATE game_attendance ga
          SET
            applied_cost = COALESCE($1::int, ga.applied_cost),
            adjustment_note = CASE
              WHEN $2::text IS NULL THEN ga.adjustment_note
              ELSE $2::text
            END
          FROM games g
          WHERE ga.attendance_id = $3
            AND ga.game_id = g.game_id
            AND g.team_id = $4
          RETURNING ga.attendance_id, ga.username, ga.applied_cost, ga.adjustment_note, g.game_id, g.game_session_id
        `,
        [appliedCost, adjustmentNote, attendance_id, team_id]
      );

      if (updateRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Attendance record not found' });
        return;
      }

      const player = updateRes.rows[0];
      emitFinanceUpdate(team_id, {
        attendance_id,
        game_id: player.game_id,
        game_session_id: player.game_session_id,
        username: player.username,
        source: 'game-attendance-update',
      });

      res.status(200).json({
        success: true,
        message: 'Game attendance updated',
        player,
      });
    } catch (error: any) {
      console.error('Error updating game attendance:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // NEW: Get list of game sessions for team
  router.get('/game-sessions', verifyToken, requireManager, async (req: Request, res: Response) => {
    const team_id = getTeamId(req);
    if (!team_id) {
      res.status(400).json({ success: false, message: 'No team id' });
      return;
    }

    try {
      const sessionsRes = await pool.query(
        `
            SELECT game_id, game_session_id, date, base_cost, notes,
                   (SELECT COUNT(*) FROM game_attendance WHERE game_id = g.game_id) as player_count
            FROM games g
            WHERE team_id = $1 AND game_session_id IS NOT NULL
            ORDER BY date DESC
            LIMIT 50
        `,
        [team_id]
      );

      res.status(200).json({
        success: true,
        sessions: sessionsRes.rows
      });
    } catch (e: any) {
      console.error('Error fetching game sessions:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // NEW: Get players in a specific game session
  router.get('/game-session-players/:game_session_id', verifyToken, requireManager, async (req: Request, res: Response) => {
    const { game_session_id } = req.params;
    const team_id = getTeamId(req);

    if (!team_id) {
      res.status(400).json({ success: false, message: 'No team id' });
      return;
    }

    try {
      // First, get the game_id from game_session_id
      const gameRes = await pool.query(
        'SELECT game_id, date, base_cost, notes FROM games WHERE game_session_id = $1 AND team_id = $2',
        [game_session_id, team_id]
      );

      if (gameRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Game session not found' });
        return;
      }

      const game = gameRes.rows[0];

      // Get all players in this game
      const playersRes = await pool.query(
        `
            SELECT ga.attendance_id, ga.username, ga.applied_cost, ga.adjustment_note
            FROM game_attendance ga
            WHERE ga.game_id = $1
            ORDER BY ga.attendance_id
        `,
        [game.game_id]
      );

      res.status(200).json({
        success: true,
        game: game,
        players: playersRes.rows
      });
    } catch (e: any) {
      console.error('Error fetching game session players:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });
}

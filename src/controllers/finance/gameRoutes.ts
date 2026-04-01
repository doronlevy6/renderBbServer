import { Request, Response, Router } from 'express';
import pool from '../../models/userModel';
import { verifyToken } from '../verifyToken';
import { getTeamId, requireManager } from '../authz';
import { emitToTeam } from '../../socket/socket';

export function registerGameRoutes(router: Router): void {
  // Game recording is restricted to managers only.
  router.post('/record-game', verifyToken, requireManager, async (req: Request, res: Response) => {
    const {
      date,
      time,
      enlistedPlayers,
      base_cost,
      notes,
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

      // 3. Check if Game Session Already Exists
      if (gameSessionId) {
        const existingGameRes = await pool.query(
          'SELECT game_id FROM games WHERE game_session_id = $1 AND team_id = $2',
          [gameSessionId, team_id]
        );

        if (existingGameRes.rows.length > 0) {
          // Game session exists, use existing game_id
          gameId = existingGameRes.rows[0].game_id;
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
      }

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

      emitToTeam(team_id, 'financeSummaryUpdated', {
        team_id,
        game_id: gameId,
        game_session_id: gameSessionId,
        source: 'record-game',
        at: new Date().toISOString(),
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
      emitToTeam(team_id, 'financeSummaryUpdated', {
        team_id,
        attendance_id,
        source: 'delete-attendance',
        at: new Date().toISOString(),
      });

      res.status(200).json({ success: true, message: 'Game record deleted for player' });
    } catch (error: any) {
      console.error('Error deleting attendance:', error);
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

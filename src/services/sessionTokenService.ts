import crypto from 'crypto';
import pool from '../models/userModel';

interface SessionUser {
  username: string;
  email: string;
  team_id: number;
  role: string;
  team_type: string | null;
}

interface IssueRefreshTokenInput {
  username: string;
  teamId: number;
  userAgent?: string | null;
  ipAddress?: string | null;
}

interface RotateRefreshTokenResult {
  user: SessionUser;
  refreshToken: string;
  refreshTokenExpiresIn: string;
}

class SessionTokenService {
  private readonly refreshTokenExpiresIn =
    process.env.REFRESH_TOKEN_EXPIRES_IN || '180d';

  public getRefreshTokenExpiresIn(): string {
    return this.refreshTokenExpiresIn;
  }

  private durationToMs(value: string, fallbackMs: number): number {
    const normalized = value.trim().toLowerCase();
    const match = normalized.match(/^(\d+)\s*([smhdw])$/);
    if (!match) return fallbackMs;

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };

    return amount * (multipliers[unit] || fallbackMs);
  }

  private computeRefreshExpiryDate(): Date {
    const defaultMs = 180 * 24 * 60 * 60 * 1000;
    const ttlMs = this.durationToMs(this.refreshTokenExpiresIn, defaultMs);
    return new Date(Date.now() + ttlMs);
  }

  private generateOpaqueToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  public async issueRefreshToken(
    input: IssueRefreshTokenInput
  ): Promise<{ refreshToken: string; refreshTokenExpiresIn: string }> {
    const rawToken = this.generateOpaqueToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.computeRefreshExpiryDate();

    await pool.query(
      `
        INSERT INTO refresh_tokens (
          username,
          team_id,
          token_hash,
          expires_at,
          user_agent,
          ip_address
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        input.username,
        input.teamId,
        tokenHash,
        expiresAt,
        input.userAgent || null,
        input.ipAddress || null,
      ]
    );

    return {
      refreshToken: rawToken,
      refreshTokenExpiresIn: this.refreshTokenExpiresIn,
    };
  }

  public async rotateRefreshToken(
    rawRefreshToken: string,
    input?: { userAgent?: string | null; ipAddress?: string | null }
  ): Promise<RotateRefreshTokenResult | null> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const tokenResult = await client.query(
        `
          SELECT token_id, username, team_id
          FROM refresh_tokens
          WHERE token_hash = $1
            AND revoked_at IS NULL
            AND expires_at > NOW()
          LIMIT 1
          FOR UPDATE
        `,
        [tokenHash]
      );

      if (tokenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const tokenRow = tokenResult.rows[0];

      await client.query(
        `
          UPDATE refresh_tokens
          SET revoked_at = NOW()
          WHERE token_id = $1
        `,
        [tokenRow.token_id]
      );

      const userResult = await client.query(
        `
          SELECT u.username, u.email, u.team_id, u.role, t.team_type
          FROM users u
          LEFT JOIN teams t ON t.team_id = u.team_id
          WHERE u.username = $1 AND u.team_id = $2
          LIMIT 1
        `,
        [tokenRow.username, tokenRow.team_id]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const newRefreshToken = this.generateOpaqueToken();
      const newRefreshHash = this.hashToken(newRefreshToken);
      const expiresAt = this.computeRefreshExpiryDate();

      await client.query(
        `
          INSERT INTO refresh_tokens (
            username,
            team_id,
            token_hash,
            expires_at,
            user_agent,
            ip_address
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          tokenRow.username,
          tokenRow.team_id,
          newRefreshHash,
          expiresAt,
          input?.userAgent || null,
          input?.ipAddress || null,
        ]
      );

      await client.query('COMMIT');

      return {
        user: userResult.rows[0] as SessionUser,
        refreshToken: newRefreshToken,
        refreshTokenExpiresIn: this.refreshTokenExpiresIn,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async revokeRefreshToken(rawRefreshToken: string): Promise<boolean> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const result = await pool.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE token_hash = $1
          AND revoked_at IS NULL
      `,
      [tokenHash]
    );
    return (result.rowCount || 0) > 0;
  }

  public async revokeAllUserRefreshTokens(
    username: string,
    teamId: number
  ): Promise<number> {
    const result = await pool.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE username = $1
          AND team_id = $2
          AND revoked_at IS NULL
      `,
      [username, teamId]
    );
    return result.rowCount || 0;
  }
}

const sessionTokenService = new SessionTokenService();
export default sessionTokenService;

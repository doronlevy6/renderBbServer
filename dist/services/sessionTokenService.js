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
const crypto_1 = __importDefault(require("crypto"));
const userModel_1 = __importDefault(require("../models/userModel"));
class SessionTokenService {
    constructor() {
        this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '180d';
    }
    getRefreshTokenExpiresIn() {
        return this.refreshTokenExpiresIn;
    }
    durationToMs(value, fallbackMs) {
        const normalized = value.trim().toLowerCase();
        const match = normalized.match(/^(\d+)\s*([smhdw])$/);
        if (!match)
            return fallbackMs;
        const amount = Number(match[1]);
        const unit = match[2];
        const multipliers = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000,
        };
        return amount * (multipliers[unit] || fallbackMs);
    }
    computeRefreshExpiryDate() {
        const defaultMs = 180 * 24 * 60 * 60 * 1000;
        const ttlMs = this.durationToMs(this.refreshTokenExpiresIn, defaultMs);
        return new Date(Date.now() + ttlMs);
    }
    generateOpaqueToken() {
        return crypto_1.default.randomBytes(48).toString('hex');
    }
    hashToken(rawToken) {
        return crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
    }
    issueRefreshToken(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const rawToken = this.generateOpaqueToken();
            const tokenHash = this.hashToken(rawToken);
            const expiresAt = this.computeRefreshExpiryDate();
            yield userModel_1.default.query(`
        INSERT INTO refresh_tokens (
          username,
          team_id,
          token_hash,
          expires_at,
          user_agent,
          ip_address
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
                input.username,
                input.teamId,
                tokenHash,
                expiresAt,
                input.userAgent || null,
                input.ipAddress || null,
            ]);
            return {
                refreshToken: rawToken,
                refreshTokenExpiresIn: this.refreshTokenExpiresIn,
            };
        });
    }
    rotateRefreshToken(rawRefreshToken, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenHash = this.hashToken(rawRefreshToken);
            const client = yield userModel_1.default.connect();
            try {
                yield client.query('BEGIN');
                const tokenResult = yield client.query(`
          SELECT token_id, username, team_id
          FROM refresh_tokens
          WHERE token_hash = $1
            AND revoked_at IS NULL
            AND expires_at > NOW()
          LIMIT 1
          FOR UPDATE
        `, [tokenHash]);
                if (tokenResult.rows.length === 0) {
                    yield client.query('ROLLBACK');
                    return null;
                }
                const tokenRow = tokenResult.rows[0];
                yield client.query(`
          UPDATE refresh_tokens
          SET revoked_at = NOW()
          WHERE token_id = $1
        `, [tokenRow.token_id]);
                const userResult = yield client.query(`
          SELECT u.username, u.email, u.team_id, u.role, t.team_type
          FROM users u
          LEFT JOIN teams t ON t.team_id = u.team_id
          WHERE u.username = $1 AND u.team_id = $2
          LIMIT 1
        `, [tokenRow.username, tokenRow.team_id]);
                if (userResult.rows.length === 0) {
                    yield client.query('ROLLBACK');
                    return null;
                }
                const newRefreshToken = this.generateOpaqueToken();
                const newRefreshHash = this.hashToken(newRefreshToken);
                const expiresAt = this.computeRefreshExpiryDate();
                yield client.query(`
          INSERT INTO refresh_tokens (
            username,
            team_id,
            token_hash,
            expires_at,
            user_agent,
            ip_address
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
                    tokenRow.username,
                    tokenRow.team_id,
                    newRefreshHash,
                    expiresAt,
                    (input === null || input === void 0 ? void 0 : input.userAgent) || null,
                    (input === null || input === void 0 ? void 0 : input.ipAddress) || null,
                ]);
                yield client.query('COMMIT');
                return {
                    user: userResult.rows[0],
                    refreshToken: newRefreshToken,
                    refreshTokenExpiresIn: this.refreshTokenExpiresIn,
                };
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                client.release();
            }
        });
    }
    revokeRefreshToken(rawRefreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenHash = this.hashToken(rawRefreshToken);
            const result = yield userModel_1.default.query(`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE token_hash = $1
          AND revoked_at IS NULL
      `, [tokenHash]);
            return (result.rowCount || 0) > 0;
        });
    }
    revokeAllUserRefreshTokens(username, teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield userModel_1.default.query(`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE username = $1
          AND team_id = $2
          AND revoked_at IS NULL
      `, [username, teamId]);
            return result.rowCount || 0;
        });
    }
}
const sessionTokenService = new SessionTokenService();
exports.default = sessionTokenService;

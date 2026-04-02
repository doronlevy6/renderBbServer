import { NextFunction, Request, Response } from 'express';

export interface AuthUserPayload {
  username?: string;
  team_id?: number;
  role?: string;
}

type AuthenticatedRequest = Request & {
  user?: AuthUserPayload;
};

export function getAuthUser(req: Request): AuthUserPayload | null {
  const user = (req as AuthenticatedRequest).user;
  return user ?? null;
}

export function getTeamId(req: Request): number | null {
  const teamId = getAuthUser(req)?.team_id;
  return typeof teamId === 'number' ? teamId : null;
}

export function getUsername(req: Request): string | null {
  const username = getAuthUser(req)?.username;
  return typeof username === 'string' && username.trim() !== ''
    ? username
    : null;
}

export function isManager(req: Request): boolean {
  return getAuthUser(req)?.role === 'manager';
}

export const requireManager = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!isManager(req)) {
    res.status(403).json({
      success: false,
      message: 'Manager access required.',
    });
    return;
  }
  next();
};

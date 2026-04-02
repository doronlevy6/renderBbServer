import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// הגדרת ממשק מדויק יותר למשתמש
interface UserPayload {
  username: string;
  userEmail: string;
  team_id: number;
  role?: string;
}

// הרחבת Request כך שיכיל `user`
interface AuthRequest extends Request {
  user?: UserPayload;
}

export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    res
      .status(500)
      .json({ success: false, message: 'Server JWT is not configured.' });
    return;
  }

  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    res
      .status(401)
      .json({ success: false, message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    req.user = decoded; // TypeScript כעת יבין את המבנה של `req.user`
    next();
  } catch (ex: any) {
    if (ex?.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired.' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

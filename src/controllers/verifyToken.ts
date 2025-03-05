import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// הגדרת ממשק מדויק יותר למשתמש
interface UserPayload {
  username: string;
  userEmail: string;
  team_id: number;
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
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    res
      .status(401)
      .json({ success: false, message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as UserPayload;
    req.user = decoded; // TypeScript כעת יבין את המבנה של `req.user`
    next();
  } catch (ex) {
    res.status(400).json({ success: false, message: 'Invalid token.' });
  }
};

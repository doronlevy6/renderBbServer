// src/controllers/verifyToken.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// הגדרת ממשק למשתמש ב-Request
interface AuthRequest extends Request {
  user?: any; // מומלץ להגדיר טיפוס מדויק יותר
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).json({ success: false, message: 'Invalid token.' });
  }
};

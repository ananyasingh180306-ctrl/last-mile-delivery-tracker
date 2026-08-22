import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-last-mile-delivery-tracker-12345';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'CUSTOMER' | 'AGENT' | 'ADMIN';
  };
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token is invalid or expired.' });
      }

      req.user = user as AuthRequest['user'];
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header is required.' });
  }
}

export function requireRole(roles: ('CUSTOMER' | 'AGENT' | 'ADMIN')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: requires one of roles [${roles.join(', ')}]` });
    }

    next();
  };
}

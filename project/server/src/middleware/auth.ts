import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { JwtPayload } from '../types';

interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      // Fetch user from database
      const user = await db.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // Remove password from user object
      const { password, ...userWithoutPassword } = user;
      req.user = userWithoutPassword;
      
      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      const user = await db.getUserById(decoded.userId);
      
      if (user) {
        const { password, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
      }
    } catch (jwtError) {
      // Ignore JWT errors for optional auth
    }
    
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next();
  }
};

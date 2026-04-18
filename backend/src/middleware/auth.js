import jwt from 'jsonwebtoken';
import { User, People } from '../db/models/index.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    );

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    const facultyProfile = await People.findOne({
      where: { user_id: user.id },
      attributes: ['id', 'slug', 'name', 'designation', 'department']
    });

    req.user = {
      ...user.get({ plain: true }),
      facultyProfile: facultyProfile?.get?.({ plain: true }) || facultyProfile || null
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired'
      });
    }
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }
    next();
  };
};

export const requireAdmin = requireRole('super_admin', 'admin');
export const requireSuperAdmin = requireRole('super_admin');
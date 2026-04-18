import jwt from 'jsonwebtoken';
import { User, People } from '../db/models/index.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const facultyProfile = await People.findOne({
      where: { user_id: user.id },
      attributes: ['id', 'slug', 'name', 'designation', 'department']
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        facultyProfileId: facultyProfile?.id || null,
        mustChangePassword: !!user.must_change_password
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: !!user.must_change_password,
          facultyProfileId: facultyProfile?.id || null,
          facultyProfile: facultyProfile || null
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const facultyProfile = await People.findOne({
      where: { user_id: req.user.id },
      attributes: ['id', 'slug', 'name', 'designation', 'department']
    });

    res.json({
      data: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        mustChangePassword: !!req.user.must_change_password,
        facultyProfileId: facultyProfile?.id || null,
        facultyProfile: facultyProfile || null
      }
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password || password.trim().length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({
      password_hash: password,
      must_change_password: false
    });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
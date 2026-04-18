import { People } from '../db/models/index.js';

export const requireOwnFacultyProfileOrAdmin = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        error: 'Faculty access required'
      });
    }

    const personId = req.params.id || req.params.personId;
    const person = await People.findByPk(personId, {
      attributes: ['id', 'user_id']
    });

    if (!person) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    if (person.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'You can only edit your own profile'
      });
    }

    req.person = person;
    next();
  } catch (error) {
    next(error);
  }
};
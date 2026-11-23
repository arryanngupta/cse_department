import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const EventRegistration = sequelize.define(
  'EventRegistration',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Name is required' },
        len: { args: [2, 160], msg: 'Name must be between 2 and 160 characters' },
      },
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: {
        isEmail: { msg: 'A valid email address is required' },
      },
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
      validate: {
        // Deliberately permissive: international formats vary, and rejecting a
        // real number is worse than storing an odd one.
        is: {
          args: /^[\d\s()+-]{6,32}$/,
          msg: 'Phone number contains unexpected characters',
        },
      },
    },
    affiliation: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: { args: [0, 2000], msg: 'Notes must be 2000 characters or fewer' },
      },
    },
    status: {
      type: DataTypes.ENUM('registered', 'waitlisted', 'cancelled', 'attended'),
      allowNull: false,
      defaultValue: 'registered',
    },
  },
  {
    tableName: 'event_registrations',
  },
);

export default EventRegistration;

import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startsAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endsAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  venue: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  banner_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  /* ---- Registration (migration 0027) ---------------------------------- */

  // Opt-in per event, so adding registration did not retroactively put a form
  // on every existing event.
  registration_open: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // Null means unlimited; beyond capacity, registrants are waitlisted.
  registration_capacity: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Null falls back to startsAt.
  registration_deadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /* ---- Scheduled publication (migration 0030) ---- */
  // Null = not scheduled. The scheduler worker flips the live flag when due.
  publish_at: { type: DataTypes.DATE, allowNull: true },
  unpublish_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'events',
  timestamps: true
});

export default Event;
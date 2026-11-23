import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const News = sequelize.define('News', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /* ---- Scheduled publication (migration 0030) ---- */
  // Null = not scheduled. The scheduler worker flips the live flag when due.
  publish_at: { type: DataTypes.DATE, allowNull: true },
  unpublish_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'news',
  timestamps: true
});

export default News;
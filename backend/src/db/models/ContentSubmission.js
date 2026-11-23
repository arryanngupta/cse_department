import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const ContentSubmission = sequelize.define(
  'ContentSubmission',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    resource: { type: DataTypes.STRING, allowNull: false },
    resource_id: { type: DataTypes.INTEGER, allowNull: true },

    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected', 'withdrawn'),
      allowNull: false,
      defaultValue: 'draft',
    },

    payload: { type: DataTypes.TEXT('long'), allowNull: false },
    note: { type: DataTypes.STRING, allowNull: true },

    submitted_by: { type: DataTypes.INTEGER, allowNull: true },
    submitter_email: { type: DataTypes.STRING, allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: true },

    reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
    reviewer_email: { type: DataTypes.STRING, allowNull: true },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    review_note: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'content_submissions',
  },
);

export default ContentSubmission;

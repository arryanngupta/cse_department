import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const ContentVersion = sequelize.define(
  'ContentVersion',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    resource: { type: DataTypes.STRING, allowNull: false },
    resource_id: { type: DataTypes.INTEGER, allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false },

    change_type: {
      type: DataTypes.ENUM('create', 'update', 'delete', 'restore'),
      allowNull: false,
    },

    snapshot: { type: DataTypes.TEXT('long'), allowNull: false },
    changed_fields: { type: DataTypes.TEXT, allowNull: true },

    user_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_email: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'content_versions',
  },
);

export default ContentVersion;

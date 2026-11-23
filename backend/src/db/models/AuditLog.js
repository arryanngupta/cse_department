import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    user_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_email: { type: DataTypes.STRING, allowNull: true },
    actor_role: { type: DataTypes.STRING, allowNull: true },

    action: { type: DataTypes.STRING, allowNull: false },
    resource: { type: DataTypes.STRING, allowNull: false },
    resource_id: { type: DataTypes.STRING, allowNull: true },

    summary: { type: DataTypes.STRING, allowNull: true },
    changed_fields: { type: DataTypes.TEXT, allowNull: true },

    method: { type: DataTypes.STRING, allowNull: true },
    path: { type: DataTypes.STRING, allowNull: true },
    status_code: { type: DataTypes.INTEGER, allowNull: true },
    ip: { type: DataTypes.STRING, allowNull: true },
    user_agent: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'audit_logs',
  },
);

export default AuditLog;

import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const PasswordReset = sequelize.define(
  'PasswordReset',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    // SHA-256 hex of the emailed token; the token itself is never stored.
    token_hash: { type: DataTypes.STRING, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
    requested_ip: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'password_resets',
  },
);

export default PasswordReset;

import { DataTypes } from 'sequelize';

/**
 * Password reset tokens.
 *
 * There was no reset flow at all: a user who forgot their password needed an
 * admin to issue a new one by hand.
 *
 * Only a SHA-256 hash of the token is stored, never the token itself. A
 * database leak then yields nothing usable — the same reasoning as storing
 * password hashes rather than passwords.
 */
export async function up(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('password_resets')) return;

  await queryInterface.createTable('password_resets', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      // Deleting the account invalidates any outstanding reset.
      onDelete: 'CASCADE',
    },
    // SHA-256 hex of the token handed to the user.
    token_hash: { type: DataTypes.STRING(64), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    // Set once consumed, so a token cannot be replayed.
    used_at: { type: DataTypes.DATE, allowNull: true },
    requested_ip: { type: DataTypes.STRING(45), allowNull: true },

    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // Lookup is always by hash.
  await queryInterface.addIndex('password_resets', ['token_hash'], {
    name: 'password_resets_token_hash',
    unique: true,
  });
  await queryInterface.addIndex('password_resets', ['user_id'], {
    name: 'password_resets_user_id',
  });
  await queryInterface.addIndex('password_resets', ['expires_at'], {
    name: 'password_resets_expires_at',
  });
}

export async function down(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('password_resets')) {
    await queryInterface.dropTable('password_resets');
  }
}

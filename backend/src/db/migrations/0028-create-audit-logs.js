import { DataTypes } from 'sequelize';

/**
 * Administrative audit log.
 *
 * There was previously no record of who changed what: a deleted news item or
 * an edited faculty bio left no trace, and with several editors sharing admin
 * rights that question could not be answered at all.
 *
 * Deliberately NOT stored here: passwords, password hashes, tokens, API keys,
 * or full request bodies. The log records that an action happened and to what,
 * not the secret material involved.
 */
export async function up(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('audit_logs')) return;

  await queryInterface.createTable('audit_logs', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Actor. Kept as a nullable FK plus denormalised copies, so the log stays
    // readable after the account is deleted — the whole point of an audit
    // trail is that it outlives the thing it describes.
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    actor_email: { type: DataTypes.STRING(160), allowNull: true },
    actor_role: { type: DataTypes.STRING(32), allowNull: true },

    // What happened.
    action: { type: DataTypes.STRING(32), allowNull: false },
    resource: { type: DataTypes.STRING(64), allowNull: false },
    resource_id: { type: DataTypes.STRING(64), allowNull: true },

    // Human-readable summary, e.g. 'Updated news "Convocation 2026"'.
    summary: { type: DataTypes.STRING(255), allowNull: true },

    // Which fields changed — names only, never values, so a bio edit does not
    // duplicate the content and a credential change logs nothing sensitive.
    changed_fields: { type: DataTypes.TEXT, allowNull: true },

    method: { type: DataTypes.STRING(8), allowNull: true },
    path: { type: DataTypes.STRING(255), allowNull: true },
    status_code: { type: DataTypes.INTEGER, allowNull: true },
    ip: { type: DataTypes.STRING(45), allowNull: true }, // IPv6-sized
    user_agent: { type: DataTypes.STRING(255), allowNull: true },

    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // The viewer filters by actor, by resource and by date, and always sorts
  // newest-first.
  await queryInterface.addIndex('audit_logs', ['createdAt'], {
    name: 'audit_logs_created_at',
  });
  await queryInterface.addIndex('audit_logs', ['user_id'], {
    name: 'audit_logs_user_id',
  });
  await queryInterface.addIndex('audit_logs', ['resource', 'resource_id'], {
    name: 'audit_logs_resource',
  });
  await queryInterface.addIndex('audit_logs', ['action'], {
    name: 'audit_logs_action',
  });
}

export async function down(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('audit_logs')) {
    await queryInterface.dropTable('audit_logs');
  }
}

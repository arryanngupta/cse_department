import { DataTypes } from 'sequelize';

/**
 * Generic content version history.
 *
 * There was previously no undo: an admin who overwrote a faculty bio or
 * deleted a news item destroyed the only copy. The audit log records *that* a
 * change happened; this records *what the content was*.
 *
 * One table for every entity rather than a per-table `*_versions` schema —
 * snapshots are read as whole documents, never joined or queried by field, so
 * a JSON payload keyed by (resource, resource_id) is the right shape and
 * avoids 12 near-identical tables.
 */
export async function up(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('content_versions')) return;

  await queryInterface.createTable('content_versions', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Which record this snapshot belongs to.
    resource: { type: DataTypes.STRING(64), allowNull: false },
    resource_id: { type: DataTypes.INTEGER, allowNull: false },

    // Monotonic per (resource, resource_id), so "version 3" is meaningful.
    version: { type: DataTypes.INTEGER, allowNull: false },

    // What produced this snapshot.
    change_type: {
      type: DataTypes.ENUM('create', 'update', 'delete', 'restore'),
      allowNull: false,
    },

    // Full row as it existed BEFORE the change, as JSON. LONGTEXT because
    // rich-text bodies and profile_sections can be large.
    snapshot: { type: DataTypes.TEXT('long'), allowNull: false },

    // Field names that differed from the previous version — names only, so a
    // snapshot diff never duplicates secret values into a second place.
    changed_fields: { type: DataTypes.TEXT, allowNull: true },

    // Actor, denormalised so history survives account deletion.
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    actor_email: { type: DataTypes.STRING(160), allowNull: true },

    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // The history view always filters by record and sorts newest-first.
  await queryInterface.addIndex('content_versions', ['resource', 'resource_id', 'version'], {
    name: 'content_versions_record',
  });
  await queryInterface.addIndex('content_versions', ['createdAt'], {
    name: 'content_versions_created_at',
  });
}

export async function down(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('content_versions')) {
    await queryInterface.dropTable('content_versions');
  }
}

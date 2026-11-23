import { DataTypes } from 'sequelize';

/**
 * Content approval workflow.
 *
 * Faculty can already edit their own profile directly (middleware/rbac.js).
 * That stays — this adds a *review* path for changes that should be checked
 * before going live, without disrupting the existing direct-edit route.
 *
 * A submission holds the *proposed* payload rather than mutating the record,
 * so nothing reaches the public site until an admin approves it. Rejecting a
 * submission therefore needs no rollback: the live record was never touched.
 */
export async function up(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('content_submissions')) return;

  await queryInterface.createTable('content_submissions', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    resource: { type: DataTypes.STRING(64), allowNull: false },
    // Null for a proposed *new* record; set when editing an existing one.
    resource_id: { type: DataTypes.INTEGER, allowNull: true },

    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected', 'withdrawn'),
      allowNull: false,
      defaultValue: 'draft',
    },

    // The proposed field values, as JSON.
    payload: { type: DataTypes.TEXT('long'), allowNull: false },

    // Short description of what is being changed, written by the submitter.
    note: { type: DataTypes.STRING(500), allowNull: true },

    submitted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    submitter_email: { type: DataTypes.STRING(160), allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: true },

    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    reviewer_email: { type: DataTypes.STRING(160), allowNull: true },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    // Required when rejecting: "no" without a reason is not actionable.
    review_note: { type: DataTypes.STRING(500), allowNull: true },

    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // The review queue filters by status; a submitter filters by their own id.
  await queryInterface.addIndex('content_submissions', ['status'], {
    name: 'content_submissions_status',
  });
  await queryInterface.addIndex('content_submissions', ['submitted_by'], {
    name: 'content_submissions_submitted_by',
  });
  await queryInterface.addIndex('content_submissions', ['resource', 'resource_id'], {
    name: 'content_submissions_resource',
  });
}

export async function down(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('content_submissions')) {
    await queryInterface.dropTable('content_submissions');
  }
}

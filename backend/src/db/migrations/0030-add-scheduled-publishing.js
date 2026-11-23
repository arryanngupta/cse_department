import { DataTypes } from 'sequelize';

/**
 * Scheduled publication.
 *
 * `isPublished` / `is_active` were binary: content went live the moment it was
 * saved. "Publish Monday at 9am" meant someone logging in on Monday at 9am.
 *
 * State lives in the database, not in process memory. An in-memory
 * `setTimeout` would be lost on every Render restart or redeploy — which for a
 * free-tier instance that sleeps on inactivity means losing it constantly.
 * A `publish_at` column plus a polling worker survives any restart, because
 * the schedule is data.
 */

/** Tables that gain scheduling, with the column that marks them live. */
const SCHEDULABLE = [
  { table: 'news', flag: 'isPublished' },
  { table: 'events', flag: 'isPublished' },
  { table: 'achievements', flag: 'isPublished' },
  { table: 'opportunity_blocks', flag: 'is_active' },
  { table: 'facilities', flag: 'is_active' },
];

export async function up(queryInterface) {
  for (const { table } of SCHEDULABLE) {
    const columns = await queryInterface.describeTable(table);

    if (!columns.publish_at) {
      await queryInterface.addColumn(table, 'publish_at', {
        // Null means "not scheduled" — either already live or a manual draft.
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    if (!columns.unpublish_at) {
      await queryInterface.addColumn(table, 'unpublish_at', {
        // Optional expiry, e.g. an opportunity that closes on a known date.
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    // Indexed because the worker polls "anything due" on an interval; without
    // it that becomes a full scan every tick.
    const indexes = await queryInterface.showIndex(table);
    const names = indexes.map((i) => i.name);

    if (!names.includes(`${table}_publish_at`)) {
      await queryInterface.addIndex(table, ['publish_at'], {
        name: `${table}_publish_at`,
      });
    }
    if (!names.includes(`${table}_unpublish_at`)) {
      await queryInterface.addIndex(table, ['unpublish_at'], {
        name: `${table}_unpublish_at`,
      });
    }
  }
}

export async function down(queryInterface) {
  for (const { table } of SCHEDULABLE) {
    const columns = await queryInterface.describeTable(table);
    for (const column of ['publish_at', 'unpublish_at']) {
      if (columns[column]) await queryInterface.removeColumn(table, column);
    }
  }
}

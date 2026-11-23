import { DataTypes } from 'sequelize';

// The Research model gained `content_json` but 0018-create-research.js was never
// updated to match, so the column is missing on databases created from that
// migration (and from the SQL dumps in the repo root). Added separately here.
//
// The migration runner has no tracking table and re-runs every file on each
// `npm run migrate`, so both directions check the current schema first.

export async function up(queryInterface) {
  const table = await queryInterface.describeTable('research');
  if (table.content_json) return;

  await queryInterface.addColumn('research', 'content_json', {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  });
}

export async function down(queryInterface) {
  const table = await queryInterface.describeTable('research');
  if (!table.content_json) return;

  await queryInterface.removeColumn('research', 'content_json');
}

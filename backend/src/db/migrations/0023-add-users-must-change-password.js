import { DataTypes } from 'sequelize';

// The Users model declares `must_change_password` but no migration ever added
// the column, so every login fails with ER_BAD_FIELD_ERROR on a database built
// from the migrations alone.
//
// The migration runner has no tracking table and re-runs every file on each
// `npm run migrate`, so both directions check the current schema first.

export async function up(queryInterface) {
  const table = await queryInterface.describeTable('users');
  if (table.must_change_password) return;

  await queryInterface.addColumn('users', 'must_change_password', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
}

export async function down(queryInterface) {
  const table = await queryInterface.describeTable('users');
  if (!table.must_change_password) return;

  await queryInterface.removeColumn('users', 'must_change_password');
}

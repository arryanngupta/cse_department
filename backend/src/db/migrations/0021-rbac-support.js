// migrations/xxxx-rbac-support.js
import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
    MODIFY role ENUM('super_admin', 'admin', 'faculty') NOT NULL DEFAULT 'admin'
  `);

  // The runner has no tracking table and re-runs every migration on each
  // `npm run migrate`, so skip the column if it is already there.
  const people = await queryInterface.describeTable('people');
  if (people.user_id) return;

  await queryInterface.addColumn('people', 'user_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });
}

export async function down(queryInterface) {
  const people = await queryInterface.describeTable('people');
  if (people.user_id) {
    await queryInterface.removeColumn('people', 'user_id');
  }

  await queryInterface.sequelize.query(`
    ALTER TABLE users
    MODIFY role ENUM('admin') NOT NULL DEFAULT 'admin'
  `);
}
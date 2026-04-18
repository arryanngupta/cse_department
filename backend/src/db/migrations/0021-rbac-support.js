// migrations/xxxx-rbac-support.js
import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
    MODIFY role ENUM('super_admin', 'admin', 'faculty') NOT NULL DEFAULT 'admin'
  `);

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
  await queryInterface.removeColumn('people', 'user_id');

  await queryInterface.sequelize.query(`
    ALTER TABLE users
    MODIFY role ENUM('admin') NOT NULL DEFAULT 'admin'
  `);
}
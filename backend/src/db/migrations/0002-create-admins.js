import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('admins', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryInterface.dropTable('admins');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

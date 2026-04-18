import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('info_blocks', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    media_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryInterface.dropTable('info_blocks');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

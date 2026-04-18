import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('news', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
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
  await queryInterface.dropTable('news');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

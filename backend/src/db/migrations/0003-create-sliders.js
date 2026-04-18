import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('sliders', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    image_path: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    caption: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    isActive: {
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
  await queryInterface.dropTable('sliders');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

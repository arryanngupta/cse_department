import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('programs', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    level: {
      type: DataTypes.ENUM('UG', 'PG', 'PhD'),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    curriculum_pdf_path: {
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
    short_name: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    overview: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    total_credits: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryInterface.dropTable('programs');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

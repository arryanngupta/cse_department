import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('events', {
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
    startsAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    venue: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    link: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    banner_path: {
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
  await queryInterface.dropTable('events');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

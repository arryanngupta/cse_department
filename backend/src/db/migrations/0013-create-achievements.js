import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('achievements', {
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
    students: {
      type: DataTypes.TEXT,
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
    category: {
      type: DataTypes.ENUM('student', 'faculty'),
      allowNull: false,
      defaultValue: 'student',
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryInterface.dropTable('achievements');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

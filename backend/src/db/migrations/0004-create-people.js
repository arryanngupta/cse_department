import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('people', {
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
    designation: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    webpage: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    research_areas: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photo_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    joining_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    education: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    publications: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    workshops: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    profile_sections: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    person_type: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Faculty',
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryInterface.dropTable('people');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

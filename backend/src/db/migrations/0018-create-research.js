import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('research', {
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
    category: {
      type: DataTypes.ENUM('Publication', 'Project', 'Patent', 'Collaboration'),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    faculty: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    funding_agency: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    funding_amount: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Ongoing', 'In Progress', 'Completed', 'Published'),
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
    display_order: {
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
    authors: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    journal: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    year: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    inventors: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    application_no: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    patent_status: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    collaboration_org: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryInterface.dropTable('research');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

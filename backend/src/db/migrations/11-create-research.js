import { DataTypes } from 'sequelize';

export const up = async (queryInterface) => {
  await queryInterface.createTable('research', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 🔹 Basic Info
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // 🔹 Project Fields
    faculty: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pi_co_pi: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    funding_agency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    funding_amount: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Ongoing', 'Completed', 'Proposed', 'In Progress'),
      defaultValue: 'Ongoing',
    },

    // 🔹 Publication
    authors: DataTypes.TEXT,
    journal: DataTypes.STRING,
    year: DataTypes.STRING,

    // 🔹 Patent
    inventors: DataTypes.TEXT,
    application_no: DataTypes.STRING,
    patent_status: DataTypes.STRING,

    // 🔹 Collaboration
    collaboration_org: DataTypes.STRING,

    // 🔹 Common
    link: DataTypes.STRING,
    image_path: DataTypes.STRING,
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('research');
};
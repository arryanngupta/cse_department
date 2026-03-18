import { DataTypes } from "sequelize";

export async function up(queryInterface) {
  await queryInterface.createTable("achievements", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    title: DataTypes.STRING,

    students: DataTypes.TEXT,

    description: DataTypes.TEXT,

    link: DataTypes.STRING,

    image_path: DataTypes.STRING,

    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable("achievements");
}
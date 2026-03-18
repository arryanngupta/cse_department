import { DataTypes } from "sequelize";

export async function up(queryInterface) {
  await queryInterface.createTable("news", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    title: DataTypes.STRING,
    date: DataTypes.DATE,
    summary: DataTypes.TEXT,
    body: DataTypes.TEXT,
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
  await queryInterface.dropTable("news");
}
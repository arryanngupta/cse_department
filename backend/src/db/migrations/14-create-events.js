import { DataTypes } from "sequelize";

export async function up(queryInterface) {
  await queryInterface.createTable("events", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    title: DataTypes.STRING,

    startsAt: DataTypes.DATE,
    endsAt: DataTypes.DATE,

    venue: DataTypes.STRING,

    description: DataTypes.TEXT,

    link: DataTypes.STRING,

    banner_path: DataTypes.STRING,

    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable("events");
}
import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('facilities', {
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
    category: {
      type: DataTypes.ENUM('Laboratory', 'Infrastructure', 'Equipment', 'Software', 'Other'),
      allowNull: false,
      defaultValue: 'Laboratory',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    specifications: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    capacity: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    in_charge: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    image_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    gallery_images: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    is_active: {
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
  await queryInterface.dropTable('facilities');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

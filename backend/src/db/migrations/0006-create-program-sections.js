import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('program_sections', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'programs',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    section_type: {
      type: DataTypes.ENUM('curriculum', 'info', 'outcome', 'overview'),
      allowNull: false,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    is_expanded: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
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
  await queryInterface.dropTable('program_sections');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

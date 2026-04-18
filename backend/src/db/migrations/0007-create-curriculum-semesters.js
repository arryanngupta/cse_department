import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('curriculum_semesters', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'program_sections',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    semester_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    semester_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
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
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await queryInterface.dropTable('curriculum_semesters');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

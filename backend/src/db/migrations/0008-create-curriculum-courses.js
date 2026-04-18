import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('curriculum_courses', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    semester_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'curriculum_semesters',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    course_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    course_type: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    theory_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    lab_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    tutorial_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    practical_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    credits: {
      type: DataTypes.INTEGER,
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
  await queryInterface.dropTable('curriculum_courses');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

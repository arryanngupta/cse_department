import { DataTypes } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.createTable('section_content', {
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
    content_html: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
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
  await queryInterface.dropTable('section_content');
  await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

import { DataTypes } from 'sequelize';
export async function up(queryInterface) {
    await queryInterface.createTable('opportunity_blocks', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        page_group: {
            type: DataTypes.ENUM('faculty', 'research', 'non_academic', 'general'),
            allowNull: false,
            defaultValue: 'general'
        },
        block_type: {
            type: DataTypes.ENUM('hero', 'accordion', 'table', 'button_group', 'links', 'note', 'rich_text'),
            allowNull: false,
            defaultValue: 'rich_text'
        },
        subtitle: {
            type: DataTypes.STRING,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        image_path: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cta_text: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cta_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        content_html: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },
        content_json: {
            type: DataTypes.JSON,
            allowNull: true
        },
        display_order: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });
}

export async function down(queryInterface) {
    await queryInterface.dropTable('opportunity_blocks');
}
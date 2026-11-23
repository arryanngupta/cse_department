import { DataTypes } from 'sequelize';

/**
 * Media library.
 *
 * Uploads already reach Cloudinary, but nothing recorded them, so an admin had
 * no way to find or reuse an image they had uploaded before. The practical
 * result was duplicate uploads of the same photo.
 *
 * This is a catalogue, not a store: the file still lives in Cloudinary. The
 * row records where it is, what it is, and where it is used.
 */
export async function up(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('media_assets')) return;

  await queryInterface.createTable('media_assets', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Absolute Cloudinary URL, which is what every content row stores.
    url: { type: DataTypes.STRING(500), allowNull: false },

    // Cloudinary's identifier, needed to delete or transform the asset.
    public_id: { type: DataTypes.STRING(255), allowNull: true },

    filename: { type: DataTypes.STRING(255), allowNull: true },
    mime_type: { type: DataTypes.STRING(100), allowNull: true },
    bytes: { type: DataTypes.INTEGER, allowNull: true },
    width: { type: DataTypes.INTEGER, allowNull: true },
    height: { type: DataTypes.INTEGER, allowNull: true },

    kind: {
      type: DataTypes.ENUM('image', 'pdf', 'other'),
      allowNull: false,
      defaultValue: 'image',
    },

    // Free-text label and alt text, so the library is searchable and uses can
    // be made accessible.
    title: { type: DataTypes.STRING(255), allowNull: true },
    alt_text: { type: DataTypes.STRING(500), allowNull: true },
    folder: { type: DataTypes.STRING(120), allowNull: true },

    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },

    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // The same file must not be catalogued twice. URL is indexed with a prefix
  // length because MySQL caps a unique index entry at 3072 bytes and a
  // utf8mb4 VARCHAR(500) exceeds that.
  await queryInterface.sequelize.query(
    'CREATE UNIQUE INDEX media_assets_url ON media_assets (url(255))',
  );

  await queryInterface.addIndex('media_assets', ['kind'], { name: 'media_assets_kind' });
  await queryInterface.addIndex('media_assets', ['createdAt'], {
    name: 'media_assets_created_at',
  });
}

export async function down(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('media_assets')) {
    await queryInterface.dropTable('media_assets');
  }
}

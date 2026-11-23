import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const MediaAsset = sequelize.define(
  'MediaAsset',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    url: { type: DataTypes.STRING(500), allowNull: false },
    public_id: { type: DataTypes.STRING, allowNull: true },

    filename: { type: DataTypes.STRING, allowNull: true },
    mime_type: { type: DataTypes.STRING, allowNull: true },
    bytes: { type: DataTypes.INTEGER, allowNull: true },
    width: { type: DataTypes.INTEGER, allowNull: true },
    height: { type: DataTypes.INTEGER, allowNull: true },

    kind: {
      type: DataTypes.ENUM('image', 'pdf', 'other'),
      allowNull: false,
      defaultValue: 'image',
    },

    title: { type: DataTypes.STRING, allowNull: true },
    alt_text: { type: DataTypes.STRING, allowNull: true },
    folder: { type: DataTypes.STRING, allowNull: true },

    uploaded_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'media_assets',
  },
);

export default MediaAsset;

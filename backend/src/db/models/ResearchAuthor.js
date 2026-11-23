import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

/**
 * Authorship link between a research record and a person.
 *
 * Exactly one of `person_id` (a department member) or `external_name` (an
 * outside collaborator) identifies the author; the model validates that.
 */
const ResearchAuthor = sequelize.define(
  'ResearchAuthor',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    research_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    person_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    external_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    author_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    role: {
      type: DataTypes.ENUM('author', 'inventor', 'investigator', 'collaborator'),
      allowNull: false,
      defaultValue: 'author',
    },
  },
  {
    tableName: 'research_authors',
    validate: {
      // Without this, a row with neither identifier would render as a blank
      // entry in an author list.
      hasAnAuthor() {
        if (!this.person_id && !this.external_name) {
          throw new Error(
            'A research author needs either person_id or external_name',
          );
        }
      },
    },
  },
);

export default ResearchAuthor;

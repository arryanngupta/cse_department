import { DataTypes } from 'sequelize';

/**
 * Join table linking research records to the people who produced them.
 *
 * Until now `research.faculty`, `research.authors` and `research.inventors`
 * were free text — real values include
 * "Dr. Jayprakash Kar, Dept. of CSE, The LNMIIT, Jaipur" and "Aryan Gupta".
 * Nothing connected a publication to a `people` row, so a faculty profile
 * could not list its own work and a paper could not link back to its authors.
 *
 * The original text columns are deliberately left in place:
 *   - they hold co-authors from outside the department, who have no `people`
 *     row and should not get one;
 *   - they are what the existing admin UI and public pages read today, so
 *     dropping them would break both.
 *
 * `external_name` covers outside collaborators, so author order stays correct
 * even when only some authors are department members.
 */
export async function up(queryInterface) {
  await queryInterface.createTable('research_authors', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    research_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'research', key: 'id' },
      onUpdate: 'CASCADE',
      // Removing a publication removes its authorship rows.
      onDelete: 'CASCADE',
    },
    person_id: {
      type: DataTypes.INTEGER,
      // Null when the author is external: the row then carries external_name.
      allowNull: true,
      references: { model: 'people', key: 'id' },
      onUpdate: 'CASCADE',
      // Deleting a person must not delete the publication's author list; the
      // row degrades to an external name instead.
      onDelete: 'SET NULL',
    },
    external_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    author_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    role: {
      // Mirrors research.category: an "author" on a paper, an "inventor" on a
      // patent, an "investigator" on a project.
      type: DataTypes.ENUM('author', 'inventor', 'investigator', 'collaborator'),
      allowNull: false,
      defaultValue: 'author',
    },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // Listing a person's publications and a publication's authors are the two
  // hot paths; both get an index.
  await queryInterface.addIndex('research_authors', ['research_id'], {
    name: 'research_authors_research_id',
  });
  await queryInterface.addIndex('research_authors', ['person_id'], {
    name: 'research_authors_person_id',
  });

  // A person must not be attached to the same record twice in the same role.
  // MySQL treats NULLs as distinct, so this does not constrain external rows.
  await queryInterface.addIndex('research_authors', ['research_id', 'person_id', 'role'], {
    name: 'research_authors_unique_link',
    unique: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('research_authors');
}

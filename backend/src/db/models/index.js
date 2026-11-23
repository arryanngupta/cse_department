// src/db/models/index.js
import User from './Users.js';
import AuditLog from './AuditLog.js';
import ContentVersion from './ContentVersion.js';
import PasswordReset from './PasswordReset.js';
import ContentSubmission from './ContentSubmission.js';
import MediaAsset from './MediaAsset.js';
import Slider from './Slider.js';
import People from './People.js';
import Program from './Program.js';
import News from './News.js';
import Event from './Event.js';
import EventRegistration from './EventRegistration.js';
import Achievement from './Achievement.js';
import Newsletter from './Newsletter.js';
import DirectoryEntry from './DirectoryEntry.js';
import InfoBlock from './InfoBlock.js';
import Research from './Research.js';
import ResearchAuthor from './ResearchAuthor.js';
import Facility from './Facility.js';
import Opportunity from './Opportunity.js';
import {
  ProgramSection,
  CurriculumSemester,
  CurriculumCourse,
  ProgramOutcome,
  SectionContent
} from './ProgramSection.js';

import { sequelize } from '../../config/database.js';

// Associations
Program.hasMany(ProgramSection, { foreignKey: 'program_id', as: 'sections' });
ProgramSection.belongsTo(Program, { foreignKey: 'program_id' });
User.hasOne(People, { foreignKey: 'user_id', as: 'facultyProfile' });
People.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'actor' });

User.hasMany(ContentVersion, { foreignKey: 'user_id', as: 'contentVersions' });
ContentVersion.belongsTo(User, { foreignKey: 'user_id', as: 'actor' });

User.hasMany(PasswordReset, { foreignKey: 'user_id', as: 'passwordResets' });
PasswordReset.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(ContentSubmission, { foreignKey: 'submitted_by', as: 'submissions' });
ContentSubmission.belongsTo(User, { foreignKey: 'submitted_by', as: 'submitter' });
ContentSubmission.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

Event.hasMany(EventRegistration, { foreignKey: 'event_id', as: 'registrations' });
EventRegistration.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

/* ---- Research authorship ----------------------------------------------
 * research_authors carries extra columns (author_order, role, external_name),
 * so link rows are reachable directly as `authorLinks` / `researchLinks` as
 * well as through the belongsToMany convenience associations.
 */
Research.hasMany(ResearchAuthor, { foreignKey: 'research_id', as: 'authorLinks' });
ResearchAuthor.belongsTo(Research, { foreignKey: 'research_id', as: 'research' });

People.hasMany(ResearchAuthor, { foreignKey: 'person_id', as: 'researchLinks' });
ResearchAuthor.belongsTo(People, { foreignKey: 'person_id', as: 'person' });

// Aliased `authorPeople`, not `authors`: Research already has a free-text
// `authors` column, and Sequelize rejects an association that shadows an
// attribute name (it throws at import time, taking the whole server down).
Research.belongsToMany(People, {
  through: ResearchAuthor,
  foreignKey: 'research_id',
  otherKey: 'person_id',
  as: 'authorPeople',
});
// `researchWorks`, not `publications`, for the same reason: People already has
// a free-text `publications` column.
People.belongsToMany(Research, {
  through: ResearchAuthor,
  foreignKey: 'person_id',
  otherKey: 'research_id',
  as: 'researchWorks',
});

// Export all
export {
  sequelize,
  User,
  AuditLog,
  ContentVersion,
  PasswordReset,
  ContentSubmission,
  MediaAsset,
  Slider,
  People,
  Program,
  News,
  Event,
  EventRegistration,
  Achievement,
  Newsletter,
  DirectoryEntry,
  InfoBlock,
  Research,
  ResearchAuthor,
  Facility,
  ProgramSection,
  CurriculumSemester,
  CurriculumCourse,
  ProgramOutcome,
  SectionContent,
  Opportunity
};

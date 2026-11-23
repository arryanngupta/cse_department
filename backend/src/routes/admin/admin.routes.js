import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { uploadImage, uploadPDF } from '../../config/multer.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { requireOwnFacultyProfileOrAdmin } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/auditLog.js';
import { versionCapture } from '../../middleware/versionCapture.js';
import {
  listVersions,
  getVersion,
  restoreVersion,
  recentVersions,
} from '../../controllers/versionController.js';
import {
  getSchedule,
  setSchedule,
  runSchedulerNow,
} from '../../controllers/scheduleController.js';
import {
  createSubmission,
  listSubmissions,
  getSubmission,
  reviewSubmission,
  withdrawSubmission,
} from '../../controllers/submissionController.js';
import {
  importOptions,
  downloadTemplate,
  previewImport,
  applyImport,
} from '../../controllers/importController.js';
import {
  listMedia,
  syncMedia,
  updateMedia,
  mediaUsage,
  deleteMedia,
  brokenReferences,
} from '../../controllers/mediaController.js';
import {
  overview,
  trends,
  activity,
  contentHealth,
} from '../../controllers/analyticsController.js';
import { listAuditLogs, auditLogSummary } from '../../controllers/auditLogController.js';
import {
  listResearchAuthors,
  addResearchAuthor,
  updateResearchAuthor,
  removeResearchAuthor,
} from '../../controllers/researchAuthorController.js';
import {
  listRegistrations,
  updateRegistration,
  deleteRegistration,
  exportRegistrations,
} from '../../controllers/eventRegistrationController.js';

import {
  createSlider, updateSlider, deleteSlider, getAllSliders,
  createPerson, updatePerson, deletePerson, getAllPeople,
  createProgram, updateProgram, deleteProgram, getAllPrograms,
  getProgramSections, createProgramSection, updateProgramSection, deleteProgramSection,
  createCurriculumSemester, deleteCurriculumSemester, createCurriculumCourse,
  updateCurriculumCourse, deleteCurriculumCourse,
  createProgramOutcome, updateProgramOutcome,
  updateSectionContent,
  createNews, updateNews, deleteNews, getAllNews,
  createEvent, updateEvent, deleteEvent, getAllEvents,
  createAchievement, updateAchievement, deleteAchievement, getAllAchievements,
  createNewsletter, updateNewsletter, deleteNewsletter, getAllNewsletters,
  createDirectoryEntry, updateDirectoryEntry, deleteDirectoryEntry, getAllDirectoryEntries,
  createInfoBlock, updateInfoBlock, deleteInfoBlock, getAllInfoBlocks,
  getAllResearch, createResearch, updateResearch, deleteResearch,
  getAllFacilities, createFacility, updateFacility, deleteFacility,
  getAllOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,createFacultyLogin,
} from '../../controllers/adminController.js';

const router = express.Router();

/* =========================
   GLOBAL AUTH
========================= */
router.use(authenticate);

// Records every state-changing admin request. After authenticate so the
// actor is known; before the routes so new endpoints are covered by default.
router.use(auditLog);

// Snapshots the pre-change state of versionable records. Must run before the
// handlers, since the previous content is unreadable once the UPDATE commits.
router.use(versionCapture);

/* =========================
   VERSION HISTORY
========================= */
/* =========================
   DASHBOARD ANALYTICS
========================= */
router.get('/analytics/overview', requireAdmin, overview);
router.get('/analytics/trends', requireAdmin, trends);
router.get('/analytics/activity', requireAdmin, activity);
router.get('/analytics/health', requireAdmin, contentHealth);

/* =========================
   MEDIA LIBRARY

   Specific paths before '/media/:id' so 'sync' and 'broken-references' are
   not captured as ids.
========================= */
router.post('/media/sync', requireAdmin, syncMedia);
router.get('/media/broken-references', requireAdmin, brokenReferences);
router.get('/media', requireAdmin, listMedia);
router.get('/media/:id/usage', requireAdmin, mediaUsage);
router.put('/media/:id', requireAdmin, updateMedia);
router.delete('/media/:id', requireAdmin, deleteMedia);

/* =========================
   CSV IMPORT (preview before apply)
========================= */
router.get('/import', requireAdmin, importOptions);
router.get('/import/:resource/template', requireAdmin, downloadTemplate);
router.post('/import/:resource/preview', requireAdmin, previewImport);
router.post('/import/:resource/apply', requireAdmin, applyImport);

/* =========================
   CONTENT SUBMISSIONS (APPROVAL WORKFLOW)

   Deliberately NOT behind requireAdmin: faculty must be able to submit and
   track their own changes. Per-action authorisation is enforced inside the
   controller, which is the only place that knows whose profile a submission
   targets. Reviewing stays admin-only.
========================= */
router.post('/submissions', createSubmission);
router.get('/submissions', listSubmissions);
router.get('/submissions/:id', getSubmission);
router.post('/submissions/:id/withdraw', withdrawSubmission);
router.post('/submissions/:id/review', requireAdmin, reviewSubmission);

/* =========================
   SCHEDULED PUBLICATION
========================= */
router.get('/schedule', requireAdmin, getSchedule);
router.post('/schedule/run', requireAdmin, runSchedulerNow);
router.put('/schedule/:resource/:id', requireAdmin, setSchedule);

router.get('/versions', requireAdmin, recentVersions);
router.get('/versions/:resource/:id', requireAdmin, listVersions);
router.get('/versions/:resource/:id/:version', requireAdmin, getVersion);
router.post('/versions/:resource/:id/:version/restore', requireAdmin, restoreVersion);

/* =========================
   AUDIT LOG (SUPER ADMIN VIEW)
========================= */
router.get('/audit-logs/summary', requireAdmin, auditLogSummary);
router.get('/audit-logs', requireAdmin, listAuditLogs);

/* =========================
   SLIDERS (ADMIN ONLY)
========================= */
router.get('/sliders', requireAdmin, getAllSliders);
router.post('/sliders', requireAdmin, uploadLimiter, uploadImage('image'), createSlider);
router.put('/sliders/:id', requireAdmin, uploadLimiter, uploadImage('image'), updateSlider);
router.delete('/sliders/:id', requireAdmin, deleteSlider);

/* =========================
   PEOPLE (RBAC ENABLED)
========================= */
router.get('/people', requireAdmin, getAllPeople);
router.post('/people', requireAdmin, uploadLimiter, uploadImage('photo'), createPerson);

// 🔥 CORE RBAC ROUTE
router.put(
  '/people/:id',
  uploadLimiter,
  uploadImage('photo'),
  requireOwnFacultyProfileOrAdmin,
  updatePerson
);

router.post(
  '/people/:personId/create-login',
  requireAdmin,
  createFacultyLogin
);

router.delete('/people/:id', requireAdmin, deletePerson);

/* =========================
   PROGRAMS (ADMIN ONLY)
========================= */
router.get('/programs', requireAdmin, getAllPrograms);
router.post('/programs', requireAdmin, uploadLimiter, uploadPDF('curriculum'), createProgram);
router.put('/programs/:id', requireAdmin, uploadLimiter, uploadPDF('curriculum'), updateProgram);
router.delete('/programs/:id', requireAdmin, deleteProgram);

/* =========================
   PROGRAM SECTIONS
========================= */
router.get('/programs/:id/sections', requireAdmin, getProgramSections);
router.post('/programs/:id/sections', requireAdmin, createProgramSection);
router.put('/programs/sections/:id', requireAdmin, updateProgramSection);
router.delete('/programs/sections/:id', requireAdmin, deleteProgramSection);

/* =========================
   CURRICULUM
========================= */
router.post('/programs/sections/:id/semesters', requireAdmin, createCurriculumSemester);
router.delete('/programs/semesters/:id', requireAdmin, deleteCurriculumSemester);
router.post('/programs/semesters/:id/courses', requireAdmin, createCurriculumCourse);
router.put('/programs/courses/:id', requireAdmin, updateCurriculumCourse);
router.delete('/programs/courses/:id', requireAdmin, deleteCurriculumCourse);

/* =========================
   OUTCOMES
========================= */
router.post('/programs/sections/:id/outcomes', requireAdmin, createProgramOutcome);
router.put('/programs/outcomes/:id', requireAdmin, updateProgramOutcome);

/* =========================
   SECTION CONTENT
========================= */
router.post('/programs/sections/content', requireAdmin, updateSectionContent);

/* =========================
   NEWS
========================= */
router.get('/news', requireAdmin, getAllNews);
router.post('/news', requireAdmin, uploadLimiter, uploadImage('image'), createNews);
router.put('/news/:id', requireAdmin, uploadLimiter, uploadImage('image'), updateNews);
router.delete('/news/:id', requireAdmin, deleteNews);

/* =========================
   EVENTS
========================= */
router.get('/events', requireAdmin, getAllEvents);
router.post('/events', requireAdmin, uploadLimiter, uploadImage('banner'), createEvent);
router.put('/events/:id', requireAdmin, uploadLimiter, uploadImage('banner'), updateEvent);
router.delete('/events/:id', requireAdmin, deleteEvent);

/* ---- Event registrations (specific paths before ':id' patterns) ---- */
router.put('/events/registrations/:registrationId', requireAdmin, updateRegistration);
router.delete('/events/registrations/:registrationId', requireAdmin, deleteRegistration);
router.get('/events/:id/registrations.csv', requireAdmin, exportRegistrations);
router.get('/events/:id/registrations', requireAdmin, listRegistrations);

/* =========================
   ACHIEVEMENTS
========================= */
router.get('/achievements', requireAdmin, getAllAchievements);
router.post('/achievements', requireAdmin, uploadLimiter, uploadImage('image'), createAchievement);
router.put('/achievements/:id', requireAdmin, uploadLimiter, uploadImage('image'), updateAchievement);
router.delete('/achievements/:id', requireAdmin, deleteAchievement);

/* =========================
   NEWSLETTERS
========================= */
router.get('/newsletters', requireAdmin, getAllNewsletters);
router.post('/newsletters', requireAdmin, uploadLimiter, uploadPDF('pdf'), createNewsletter);
router.put('/newsletters/:id', requireAdmin, uploadLimiter, uploadPDF('pdf'), updateNewsletter);
router.delete('/newsletters/:id', requireAdmin, deleteNewsletter);

/* =========================
   DIRECTORY
========================= */
router.get('/directory', requireAdmin, getAllDirectoryEntries);
router.post('/directory', requireAdmin, createDirectoryEntry);
router.put('/directory/:id', requireAdmin, updateDirectoryEntry);
router.delete('/directory/:id', requireAdmin, deleteDirectoryEntry);

/* =========================
   INFO BLOCKS
========================= */
router.get('/info-blocks', requireAdmin, getAllInfoBlocks);
router.post('/info-blocks', requireAdmin, uploadLimiter, uploadImage('media'), createInfoBlock);
router.put('/info-blocks/:id', requireAdmin, uploadLimiter, uploadImage('media'), updateInfoBlock);
router.delete('/info-blocks/:id', requireAdmin, deleteInfoBlock);

/* =========================
   RESEARCH
========================= */
router.get('/research', requireAdmin, getAllResearch);
router.post('/research', requireAdmin, uploadLimiter, uploadImage('image'), createResearch);
router.put('/research/:id', requireAdmin, uploadLimiter, uploadImage('image'), updateResearch);
router.delete('/research/:id', requireAdmin, deleteResearch);

/* ---- Research authorship links ---------------------------------------
 * The '/research/authors/:linkId' routes are declared before '/research/:id'
 * patterns that could otherwise capture "authors" as an id.
 */
router.put('/research/authors/:linkId', requireAdmin, updateResearchAuthor);
router.delete('/research/authors/:linkId', requireAdmin, removeResearchAuthor);
router.get('/research/:id/authors', requireAdmin, listResearchAuthors);
router.post('/research/:id/authors', requireAdmin, addResearchAuthor);

/* =========================
   FACILITIES
========================= */
router.get('/facilities', requireAdmin, getAllFacilities);
router.post('/facilities', requireAdmin, uploadLimiter, uploadImage('image'), createFacility);
router.put('/facilities/:id', requireAdmin, uploadLimiter, uploadImage('image'), updateFacility);
router.delete('/facilities/:id', requireAdmin, deleteFacility);

/* =========================
   EDITOR IMAGE UPLOAD
========================= */
router.post(
  '/upload-editor-image',
  requireAdmin,
  uploadLimiter,
  uploadImage('image'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Image required' });
      }

      res.json({
        url: req.file.path
      });
    } catch (err) {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

/* =========================
   OPPORTUNITIES
========================= */
router.get('/opportunities', requireAdmin, getAllOpportunities);
router.post('/opportunities', requireAdmin, uploadLimiter, uploadImage('image'), createOpportunity);
router.put('/opportunities/:id', requireAdmin, uploadLimiter, uploadImage('image'), updateOpportunity);
router.delete('/opportunities/:id', requireAdmin, deleteOpportunity);

export default router;
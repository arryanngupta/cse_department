import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { uploadImage, uploadPDF } from '../../config/multer.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { requireOwnFacultyProfileOrAdmin } from '../../middleware/rbac.js';

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
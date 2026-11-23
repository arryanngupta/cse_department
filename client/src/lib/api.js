// src/lib/api.js
import axios from 'axios';

// Base URLs (env pref) ------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3022';
const API_BASE_URL = `${BASE_URL}/api`;

// Axios instance -------------------------------------------------------------
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000, // 15s
});

// Attach auth token to requests if present -----------------------------------
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // localStorage can throw in private-mode / blocked-cookie contexts;
      // the request just goes out unauthenticated.
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor (handle 401 -> redirect to admin login) ------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('token');
      } catch {
        // Nothing to clean up if storage is unavailable.
      }
      // Some endpoints are reachable from the public site with an optional
      // session — the assistant is one. A stale token there must not bounce a
      // visitor who was only reading the website to the admin login page; the
      // caller handles that 401 itself.
      const skipRedirect = error?.config?.noAuthRedirect === true;

      if (!skipRedirect && !window.location.pathname.includes('/admin/login')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// ========================
// AUTH APIs (named export)
// ========================
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  changePassword: (password) => api.post('/auth/change-password', { password }),
};

// ========================
// PUBLIC APIs (named export)
// ========================
export const publicAPI = {
  getSliders: (params) => api.get('/public/sliders', { params }),
  getPeople: (params) => api.get('/public/people', { params }),
  getPersonBySlug: (slug) =>
    api.get(`/public/people/${encodeURIComponent(slug)}`),

  getPrograms: (params) => api.get('/public/programs', { params }),
  getProgramDetails: (id) => api.get(`/public/programs/${id}`),

  getNews: (params) => api.get('/public/news', { params }),
  getNewsById: (id) => api.get(`/public/news/${id}`),

  getEvents: (params) => api.get('/public/events', { params }),
  getEventById: (id) => api.get(`/public/events/${id}`), // ✅ FIX

  getAchievements: (params) => api.get('/public/achievements', { params }),

  getNewsletters: (params) => api.get('/public/newsletters', { params }),
  getDirectory: () => api.get('/public/directory'),

  getInfoBlock: (key) =>
    api.get(`/public/info/${encodeURIComponent(key)}`),

  getResearch: (params) => api.get('/public/research', { params }),
  // Was missing while ResearchDetail.jsx already called it, so the research
  // detail page failed with "fetcher is not a function" on every visit.
  getResearchById: (id) => api.get(`/public/research/${id}`),
  getFacilities: (params) => api.get('/public/facilities', { params }),

  // Opportunity
  getOpportunities: (params) => api.get('/public/opportunities', { params }),
  getOpportunityById: (id) => api.get(`/public/opportunities/${id}`),

  getFacilityById: (id) => api.get(`/public/facilities/${id}`),
  getAchievementById: (id) => api.get(`/public/achievements/${id}`),

  // Event registration
  eventRegistrationStatus: (id) => api.get(`/public/events/${id}/registration`),
  registerForEvent: (id, payload) => api.post(`/public/events/${id}/register`, payload),

  // Site-wide search
  search: (params, config) => api.get('/public/search', { params, ...config }),
  searchSuggestions: (q, config) =>
    api.get('/public/search/suggestions', { params: { q }, ...config }),
  searchCategories: () => api.get('/public/search/categories'),

  // AI assistant
  assistantStatus: () => api.get('/public/assistant/status'),
  askAssistant: (question, config) =>
    api.post('/public/assistant/ask', { question }, { noAuthRedirect: true, ...config }),
};


// ========================
// ADMIN APIs (named export)
// ========================
export const adminAPI = {
  // Dashboard analytics
  getAnalyticsOverview: () => api.get('/admin/analytics/overview'),
  getAnalyticsTrends: (params) => api.get('/admin/analytics/trends', { params }),
  getAnalyticsActivity: (params) => api.get('/admin/analytics/activity', { params }),
  getAnalyticsHealth: () => api.get('/admin/analytics/health'),

  // Media library
  getMedia: (params) => api.get('/admin/media', { params }),
  syncMedia: () => api.post('/admin/media/sync'),
  updateMedia: (id, payload) => api.put(`/admin/media/${id}`, payload),
  getMediaUsage: (id) => api.get(`/admin/media/${id}/usage`),
  deleteMedia: (id) => api.delete(`/admin/media/${id}`),
  getBrokenMediaReferences: () => api.get('/admin/media/broken-references'),

  // Submissions / approval workflow
  createSubmission: (payload) => api.post('/admin/submissions', payload),
  getSubmissions: (params) => api.get('/admin/submissions', { params }),
  getSubmission: (id) => api.get(`/admin/submissions/${id}`),
  reviewSubmission: (id, payload) => api.post(`/admin/submissions/${id}/review`, payload),
  withdrawSubmission: (id) => api.post(`/admin/submissions/${id}/withdraw`),

  // Version history
  getRecentVersions: (params) => api.get('/admin/versions', { params }),
  getVersions: (resource, id, params) => api.get(`/admin/versions/${resource}/${id}`, { params }),
  getVersion: (resource, id, version) => api.get(`/admin/versions/${resource}/${id}/${version}`),
  restoreVersion: (resource, id, version) => api.post(`/admin/versions/${resource}/${id}/${version}/restore`),

  // Scheduled publication
  getSchedule: () => api.get('/admin/schedule'),
  setSchedule: (resource, id, payload) => api.put(`/admin/schedule/${resource}/${id}`, payload),
  runScheduler: () => api.post('/admin/schedule/run'),

  // CSV import
  getImportOptions: () => api.get('/admin/import'),
  downloadImportTemplate: (resource) =>
    api.get(`/admin/import/${resource}/template`, { responseType: 'text' }),
  previewImport: (resource, csv) => api.post(`/admin/import/${resource}/preview`, { csv }),
  applyImport: (resource, csv, allowPartial) => api.post(`/admin/import/${resource}/apply`, { csv, allowPartial }),

  // Audit log (read-only)
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  getAuditLogSummary: () => api.get('/admin/audit-logs/summary'),

  // Event registrations
  getEventRegistrations: (id, params) => api.get(`/admin/events/${id}/registrations`, { params }),
  updateEventRegistration: (regId, payload) => api.put(`/admin/events/registrations/${regId}`, payload),
  deleteEventRegistration: (regId) => api.delete(`/admin/events/registrations/${regId}`),
  exportEventRegistrationsUrl: (id) => `/admin/events/${id}/registrations.csv`,

  // Sliders
  getSliders: (params) => api.get('/admin/sliders', { params }),
  createSlider: (formData) =>
    api.post('/admin/sliders', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateSlider: (id, formData) =>
    api.put(`/admin/sliders/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteSlider: (id) => api.delete(`/admin/sliders/${id}`),

  // People
  getPeople: (params) => api.get('/admin/people', { params }),
  createPerson: (formData) =>
    api.post('/admin/people', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updatePerson: (id, formData) =>
    api.put(`/admin/people/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deletePerson: (id) => api.delete(`/admin/people/${id}`),
  createFacultyLogin: (personId) => api.post(`/admin/people/${personId}/create-login`),

  // Programs
  getPrograms: () => api.get('/admin/programs'),
  createProgram: (formData) =>
    api.post('/admin/programs', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateProgram: (id, formData) =>
    api.put(`/admin/programs/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteProgram: (id) => api.delete(`/admin/programs/${id}`),

  // Program Sections (admin)
  getProgramSections: (programId) => api.get(`/admin/programs/${programId}/sections`),
  createProgramSection: (programId, data) => api.post(`/admin/programs/${programId}/sections`, data),
  updateProgramSection: (sectionId, data) => api.put(`/admin/programs/sections/${sectionId}`, data),
  deleteProgramSection: (sectionId) => api.delete(`/admin/programs/sections/${sectionId}`),

  // Curriculum (semesters & courses)
  createSemester: (sectionId, data) => api.post(`/admin/programs/sections/${sectionId}/semesters`, data),
  deleteSemester: (semesterId) => api.delete(`/admin/programs/semesters/${semesterId}`),
  createCourse: (semesterId, data) => api.post(`/admin/programs/semesters/${semesterId}/courses`, data),
  updateCourse: (courseId, data) => api.put(`/admin/programs/courses/${courseId}`, data),
  deleteCourse: (courseId) => api.delete(`/admin/programs/courses/${courseId}`),

  // Outcomes
  createOutcome: (sectionId, data) => api.post(`/admin/programs/sections/${sectionId}/outcomes`, data),
  updateOutcome: (outcomeId, data) => api.put(`/admin/programs/outcomes/${outcomeId}`, data),
  deleteOutcome: (outcomeId) => api.delete(`/admin/programs/outcomes/${outcomeId}`),

  // Section content (overview/info)
  saveSectionContent: (data) => api.post(`/admin/programs/sections/content`, data),
  getProgramDetailsAdmin: (programId) => api.get(`/admin/programs/${programId}`),
  uploadEditorImage: (formData) =>
    api.post('/admin/upload-editor-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  // News
  getNews: () => api.get('/admin/news'),
  createNews: (formData) =>
    api.post('/admin/news', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateNews: (id, formData) =>
    api.put(`/admin/news/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteNews: (id) => api.delete(`/admin/news/${id}`),

  // Events
  getEvents: () => api.get('/admin/events'),
  createEvent: (formData) =>
    api.post('/admin/events', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateEvent: (id, formData) =>
    api.put(`/admin/events/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteEvent: (id) => api.delete(`/admin/events/${id}`),

  // Achievements
  getAchievements: () => api.get('/admin/achievements'),
  createAchievement: (formData) =>
    api.post('/admin/achievements', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateAchievement: (id, formData) =>
    api.put(`/admin/achievements/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteAchievement: (id) => api.delete(`/admin/achievements/${id}`),

  // Newsletters
  getNewsletters: () => api.get('/admin/newsletters'),
  createNewsletter: (formData) =>
    api.post('/admin/newsletters', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateNewsletter: (id, formData) =>
    api.put(`/admin/newsletters/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteNewsletter: (id) => api.delete(`/admin/newsletters/${id}`),

  // Directory
  getDirectory: () => api.get('/admin/directory'),
  createDirectoryEntry: (data) => api.post('/admin/directory', data),
  updateDirectoryEntry: (id, data) => api.put(`/admin/directory/${id}`, data),
  deleteDirectoryEntry: (id) => api.delete(`/admin/directory/${id}`),

  // Info Blocks
  getInfoBlocks: () => api.get('/admin/info-blocks'),
  createInfoBlock: (formData) =>
    api.post('/admin/info-blocks', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateInfoBlock: (id, formData) =>
    api.put(`/admin/info-blocks/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteInfoBlock: (id) => api.delete(`/admin/info-blocks/${id}`),

  // Research
  getResearch: () => api.get('/admin/research'),
  createResearch: (formData) =>
    api.post('/admin/research', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateResearch: (id, formData) =>
    api.put(`/admin/research/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteResearch: (id) => api.delete(`/admin/research/${id}`),

  // Facilities
  getFacilities: () => api.get('/admin/facilities'),
  createFacility: (formData) =>
    api.post('/admin/facilities', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateFacility: (id, formData) =>
    api.put(`/admin/facilities/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteFacility: (id) => api.delete(`/admin/facilities/${id}`),

  // Opportunity
  getOpportunities: () => api.get('/admin/opportunities'),
  createOpportunity: (formData) =>
    api.post('/admin/opportunities', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateOpportunity: (id, formData) =>
    api.put(`/admin/opportunities/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteOpportunity: (id) => api.delete(`/admin/opportunities/${id}`),
};

// default export for existing default-import usages --------------------------------
export default api;
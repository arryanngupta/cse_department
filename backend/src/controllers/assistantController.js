// backend/src/controllers/assistantController.js

import { ask, status } from '../services/assistantService.js';

const MAX_BODY_QUESTION = 500;

/**
 * POST /api/public/assistant/ask  { question }
 *
 * `question` is the only field read from the request. Anything else a caller
 * sends — person_id, personId, facultyId, user_id, role, email, scope — is
 * ignored, because identity is resolved from the verified JWT in
 * optionalAuthenticate and looked up in the database. There is deliberately no
 * code path from the request body to the access scope.
 */
export const askAssistant = async (req, res, next) => {
  try {
    const question = req.body?.question;

    if (typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'A question is required' });
    }

    if (question.length > MAX_BODY_QUESTION) {
      return res.status(400).json({
        error: `Question is too long (max ${MAX_BODY_QUESTION} characters)`,
      });
    }

    // req.user is null for an anonymous visitor and a verified user otherwise.
    // An invalid or expired token never reaches here — optionalAuthenticate
    // rejects it with 401 rather than degrading it to anonymous.
    const result = await ask(question, { user: req.user || null });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/** GET /api/public/assistant/status — drives the widget and the admin panel. */
export const assistantStatus = async (req, res, next) => {
  try {
    const data = await status();
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

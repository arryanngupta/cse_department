// backend/src/controllers/eventRegistrationController.js

import { Op } from 'sequelize';
import { Event, EventRegistration, sequelize } from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { toCsv, safeFilename } from '../utils/csv.js';
import { sendTemplate } from '../services/emailService.js';

/** Statuses that occupy a seat. */
const SEAT_TAKING = ['registered', 'attended'];

/**
 * Whether an event is currently accepting registrations, and why not.
 * Returned to the public so the form can explain itself rather than just
 * being absent.
 */
const registrationState = async (event) => {
  if (!event.isPublished) return { open: false, reason: 'This event is not published.' };
  if (!event.registration_open) {
    return { open: false, reason: 'Registration is not open for this event.' };
  }

  const deadline = event.registration_deadline || event.startsAt;
  if (deadline && new Date(deadline) < new Date()) {
    return { open: false, reason: 'The registration deadline has passed.' };
  }

  const taken = await EventRegistration.count({
    where: { event_id: event.id, status: { [Op.in]: SEAT_TAKING } },
  });

  const capacity = event.registration_capacity;
  const full = capacity !== null && capacity !== undefined && taken >= capacity;

  return {
    open: true,
    full,
    capacity: capacity ?? null,
    registered: taken,
    remaining: capacity === null || capacity === undefined ? null : Math.max(0, capacity - taken),
    reason: full ? 'This event is full — you will be added to the waitlist.' : null,
  };
};

/** GET /api/events/:id/registration — public status, no personal data. */
export const getRegistrationStatus = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      attributes: [
        'id', 'title', 'startsAt', 'isPublished',
        'registration_open', 'registration_capacity', 'registration_deadline',
      ],
    });
    if (!event) throw new ApiError(404, 'Event not found');

    const state = await registrationState(event);

    res.json({
      data: {
        eventId: event.id,
        title: event.title,
        deadline: event.registration_deadline || event.startsAt || null,
        ...state,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/events/:id/register
 *
 * Public. Creating the row and counting seats happen in one transaction with a
 * row lock on the event, so two simultaneous submissions for the last seat
 * cannot both be accepted.
 */
export const registerForEvent = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const event = await Event.findByPk(req.params.id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!event) throw new ApiError(404, 'Event not found');

    const state = await registrationState(event);
    if (!state.open) throw new ApiError(409, state.reason);

    const { name, email, phone, affiliation, notes } = req.body || {};

    if (!name || !email) {
      throw new ApiError(400, 'Name and email are required');
    }

    const registration = await EventRegistration.create(
      {
        event_id: event.id,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        affiliation: affiliation ? String(affiliation).trim() : null,
        notes: notes ? String(notes).trim() : null,
        // Over capacity goes to the waitlist rather than being refused.
        status: state.full ? 'waitlisted' : 'registered',
      },
      { transaction: tx },
    );

    await tx.commit();

    // Confirmation email, after commit so a mail failure cannot roll back a
    // successful registration. sendTemplate never throws and is inert when no
    // provider is configured.
    await sendTemplate('eventRegistration', {
      to: registration.email,
      name: registration.name,
      eventTitle: event.title,
      startsAt: event.startsAt,
      venue: event.venue,
      waitlisted: registration.status === 'waitlisted',
    });

    // Deliberately minimal: never echo back other registrants or counts that
    // could be used to enumerate attendees.
    res.status(201).json({
      data: {
        status: registration.status,
        message:
          registration.status === 'waitlisted'
            ? 'You have been added to the waitlist. We will contact you if a place opens up.'
            : 'Registration confirmed. We look forward to seeing you.',
      },
    });
  } catch (error) {
    await tx.rollback();

    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(
        new ApiError(409, 'This email address is already registered for this event'),
      );
    }
    next(error);
  }
};

/** GET /api/admin/events/:id/registrations */
export const listRegistrations = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, { attributes: ['id', 'title'] });
    if (!event) throw new ApiError(404, 'Event not found');

    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 50 });
    const { status } = req.query;

    const where = { event_id: event.id };
    if (status) where.status = status;

    const { count, rows } = await EventRegistration.findAndCountAll({
      where,
      order: [['createdAt', 'ASC']],
      limit,
      offset,
    });

    const counts = await EventRegistration.findAll({
      where: { event_id: event.id },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      group: ['status'],
      raw: true,
    });

    res.json({
      data: rows,
      meta: {
        ...buildMeta(count, { page, limit }),
        event: { id: event.id, title: event.title },
        byStatus: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/admin/events/registrations/:registrationId — change status. */
export const updateRegistration = async (req, res, next) => {
  try {
    const registration = await EventRegistration.findByPk(req.params.registrationId);
    if (!registration) throw new ApiError(404, 'Registration not found');

    const { status } = req.body || {};
    const allowed = ['registered', 'waitlisted', 'cancelled', 'attended'];

    if (!allowed.includes(status)) {
      throw new ApiError(400, `status must be one of: ${allowed.join(', ')}`);
    }

    registration.status = status;
    await registration.save();

    res.json({ data: registration });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/admin/events/registrations/:registrationId */
export const deleteRegistration = async (req, res, next) => {
  try {
    const registration = await EventRegistration.findByPk(req.params.registrationId);
    if (!registration) throw new ApiError(404, 'Registration not found');

    await registration.destroy();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/events/:id/registrations.csv */
export const exportRegistrations = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, { attributes: ['id', 'title'] });
    if (!event) throw new ApiError(404, 'Event not found');

    const rows = await EventRegistration.findAll({
      where: { event_id: event.id },
      order: [['createdAt', 'ASC']],
      raw: true,
    });

    const csv = toCsv(
      [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'affiliation', label: 'Affiliation' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' },
        { key: 'registered_at', label: 'Registered At' },
      ],
      // ISO timestamps sort correctly as text and are parsed by spreadsheets;
      // the raw Date stringifies to "Mon Nov 23 2026 16:52:02 GMT+0530 (...)".
      rows.map((row) => ({
        ...row,
        registered_at: row.createdAt
          ? new Date(row.createdAt).toISOString().replace('T', ' ').slice(0, 19)
          : '',
      })),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename(event.title, 'event')}-registrations.csv"`,
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

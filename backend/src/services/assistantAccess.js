// backend/src/services/assistantAccess.js
//
// Access scope for an assistant request.
//
// This module answers one question: given a *verified* authentication context,
// which website records is this request allowed to see? It is the only place
// that decision is made, and everything downstream — retrieval, context
// construction, citations — is derived from its output.
//
// Two rules govern everything here:
//
//   1. Identity comes from the server. The person id is resolved by querying
//      `people.user_id` against the authenticated user's primary key. Nothing
//      in the request body, query string, or headers can influence it. A
//      request claiming `person_id` or `role` is ignored outright.
//
//   2. Ambiguity fails closed. If a faculty account cannot be mapped to
//      exactly one People row, the request is denied rather than falling back
//      to unrestricted retrieval. Zero rows and two rows are both errors —
//      guessing which profile "probably" belongs to the account is how one
//      faculty member ends up reading another's record.

import { People, ResearchAuthor } from '../db/models/index.js';

/** Scope kinds. Exported for tests and for readable comparisons. */
export const SCOPE = {
  PUBLIC: 'public',
  FACULTY_SELF: 'faculty_self',
  DENIED: 'denied',
};

/**
 * Sources whose rows describe a specific person.
 *
 * These are the only sources that need ownership filtering; the rest describe
 * the department rather than an individual. Keeping the list explicit means a
 * newly added person-bearing source has to be classified deliberately instead
 * of defaulting to "visible to everyone".
 */
export const PERSON_SCOPED_SOURCES = ['faculty', 'research', 'directory'];

/**
 * Resolve the access scope for a request.
 *
 * @param {object|null} user  `req.user` as produced by optionalAuthenticate —
 *                            already verified, or null for anonymous.
 * @returns {Promise<{scope: string, personId: number|null, role: string|null,
 *                    reason: string|null, label: string}>}
 */
export const resolveAccessScope = async (user) => {
  // Anonymous visitor: the published public website, exactly as a browser sees it.
  if (!user) {
    return {
      scope: SCOPE.PUBLIC,
      personId: null,
      role: null,
      reason: null,
      label: 'public',
    };
  }

  const role = String(user.role || '').toLowerCase();

  /*
   * Admin and Super Admin are deliberately *not* given wider retrieval than a
   * visitor.
   *
   * It is tempting to let an admin query their own database through the
   * assistant, but that turns a chat box into an unaudited export channel for
   * drafts, submissions and contact details, reachable with nothing but a
   * stolen session. Administrative data has a purpose-built, audited UI. If
   * admin-scoped answering is ever wanted it should be a separate, explicitly
   * authorised feature — not a side effect of being logged in.
   */
  if (role === 'admin' || role === 'super_admin') {
    return {
      scope: SCOPE.PUBLIC,
      personId: null,
      role,
      reason: null,
      label: 'public (admin session)',
    };
  }

  if (role === 'faculty') {
    // Count every candidate rather than taking the first match: findOne would
    // silently pick one of two linked profiles and look like it worked.
    const profiles = await People.findAll({
      where: { user_id: user.id },
      attributes: ['id', 'name', 'slug'],
    });

    if (profiles.length !== 1) {
      return {
        scope: SCOPE.DENIED,
        personId: null,
        role,
        reason:
          profiles.length === 0
            ? 'no_faculty_profile'
            : 'ambiguous_faculty_profile',
        label: 'denied',
      };
    }

    const personId = profiles[0].id;

    // Guard against a non-numeric or zero id reaching a WHERE clause.
    if (!Number.isInteger(personId) || personId <= 0) {
      return {
        scope: SCOPE.DENIED,
        personId: null,
        role,
        reason: 'invalid_faculty_profile',
        label: 'denied',
      };
    }

    return {
      scope: SCOPE.FACULTY_SELF,
      personId,
      role,
      reason: null,
      label: 'faculty (self only)',
    };
  }

  // An unrecognised role is not quietly treated as a visitor: a role the
  // policy has never been reasoned about gets no retrieval at all.
  return {
    scope: SCOPE.DENIED,
    personId: null,
    role: role || null,
    reason: 'unsupported_role',
    label: 'denied',
  };
};

/**
 * The research record ids linked to a person through `research_authors`.
 *
 * Used to restrict the research source for a faculty session. Returns an empty
 * array when the person has no linked work, which callers must treat as
 * "retrieve nothing" rather than "no filter" — an empty IN () list that gets
 * dropped would expose the whole table.
 */
export const researchIdsForPerson = async (personId) => {
  if (!Number.isInteger(personId) || personId <= 0) return [];

  const links = await ResearchAuthor.findAll({
    where: { person_id: personId },
    attributes: ['research_id'],
  });

  return [
    ...new Set(
      links
        .map((l) => l.research_id)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
};

/**
 * Translate a scope into per-source retrieval constraints.
 *
 * The returned object maps a source `type` to either:
 *   - `false`  — exclude this source from retrieval entirely, or
 *   - an object — extra Sequelize `where` clauses to AND into the query.
 *
 * A source absent from the map is unconstrained. Constraints are applied in
 * the database query itself, not after the rows come back.
 *
 * @returns {Promise<{allowAll: boolean, constraints: Record<string, object|false>}>}
 */
export const buildRetrievalConstraints = async (accessScope) => {
  if (accessScope.scope === SCOPE.DENIED) {
    // Nothing is retrievable. Callers should refuse before reaching here, but
    // an empty allow-list means a missed check still yields no data.
    return {
      allowAll: false,
      constraints: Object.fromEntries(
        PERSON_SCOPED_SOURCES.map((t) => [t, false]),
      ),
      denyEverything: true,
    };
  }

  if (accessScope.scope === SCOPE.PUBLIC) {
    return { allowAll: true, constraints: {}, denyEverything: false };
  }

  // FACULTY_SELF.
  const researchIds = await researchIdsForPerson(accessScope.personId);

  return {
    allowAll: false,
    denyEverything: false,
    constraints: {
      // Only this faculty member's own People row.
      faculty: { id: accessScope.personId },

      // Only research relationally linked to them. With no linked work the
      // source is excluded rather than left unfiltered — research rows carry
      // free-text `authors`, `faculty` and `inventors` columns naming other
      // people, so an unfiltered row leaks a third party's name.
      research: researchIds.length ? { id: researchIds } : false,

      // The directory is a contact list for other staff: phone numbers and
      // email addresses that are not this faculty member's own record.
      directory: false,
    },
  };
};

/**
 * Human-readable refusal for a denied scope.
 *
 * Deliberately vague about *why* — telling a caller "your account maps to two
 * faculty profiles" is internal detail they cannot act on and an attacker can.
 */
export const denialMessage = () =>
  'Your account is not currently linked to a faculty profile, so I cannot ' +
  'look up your information. Please contact the department administrator.';

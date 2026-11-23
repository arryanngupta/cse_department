// backend/tests/helpers/assistantFixtures.js
//
// Fixtures for the faculty-isolation tests: two faculty accounts, each linked
// to its own People row, plus research records linked to one of them.
//
// These are created directly through the models rather than over HTTP because
// the thing under test is a database-layer access control, and the fixtures
// need a guaranteed `people.user_id` link that no public API exposes.
//
// Safety: every row carries the FIXTURE_TAG in a field that is part of its
// natural key (email / title), and teardown deletes strictly by those keys and
// by the ids this module created. Nothing is matched by pattern alone, so a
// real faculty member whose name happens to resemble a fixture cannot be
// removed. The suite that uses this is the only non-read-only test file in the
// project, which is why it is opt-out via ASSISTANT_FIXTURES=0.


import {
  sequelize,
  User,
  People,
  Research,
  ResearchAuthor,
} from '../../src/db/models/index.js';

export const FIXTURE_TAG = 'assistant-isolation-fixture';

export const FACULTY_A = {
  email: `faculty-a.${FIXTURE_TAG}@example.invalid`,
  password: 'FixtureA#2026pass',
  name: 'Zeta Fixturewood',
  researchArea: 'Zetagraphic Cryptosystems',
  phone: '0141-9000001',
};

export const FACULTY_B = {
  email: `faculty-b.${FIXTURE_TAG}@example.invalid`,
  password: 'FixtureB#2026pass',
  name: 'Omega Quillborne',
  researchArea: 'Omegaform Lattice Networks',
  phone: '0141-9000002',
};

/**
 * Distinctive, unique-to-the-fixture research titles.
 *
 * Deliberately nonsense words: a test asserting "Faculty A's answer never
 * contains Faculty B's publication" is only meaningful if that publication
 * title cannot appear by coincidence in real content.
 */
export const RESEARCH_A = `Zetagraphic Threshold Signatures over Sparse Fields (${FIXTURE_TAG})`;
export const RESEARCH_B = `Omegaform Routing under Adversarial Churn (${FIXTURE_TAG})`;

const created = { users: [], people: [], research: [], links: [] };

const makeFaculty = async (spec, slugSuffix) => {
  const user = await User.create({
    name: spec.name,
    email: spec.email,
    // The plaintext password goes in as-is: User has a beforeCreate hook that
    // bcrypts whatever is in password_hash. Hashing here as well produced a
    // double hash and a fixture that could not sign in.
    password_hash: spec.password,
    role: 'faculty',
    must_change_password: false,
  });
  created.users.push(user.id);

  const person = await People.create({
    user_id: user.id,
    slug: `fixture-${slugSuffix}-${user.id}`,
    name: spec.name,
    designation: 'Assistant Professor',
    person_type: 'Faculty',
    email: spec.email,
    phone: spec.phone,
    research_areas: spec.researchArea,
    summary: `${spec.name} works on ${spec.researchArea}.`,
    bio: `Fixture biography for ${spec.name}.`,
    department: 'Computer Science & Engineering',
  });
  created.people.push(person.id);

  return { user, person, spec };
};

const makeResearch = async (title, personId) => {
  const research = await Research.create({
    title,
    category: 'Publication',
    description: `Fixture publication record: ${title}.`,
    year: 2026,
    status: 'Published',
  });
  created.research.push(research.id);

  const link = await ResearchAuthor.create({
    research_id: research.id,
    person_id: personId,
    author_order: 1,
    role: 'author',
  });
  created.links.push(link.id);

  return research;
};

/**
 * Create both faculty fixtures. Idempotent in the sense that it removes any
 * leftovers from a previous interrupted run first.
 */
export const setupFixtures = async () => {
  await teardownFixtures();

  const a = await makeFaculty(FACULTY_A, 'a');
  const b = await makeFaculty(FACULTY_B, 'b');

  const researchA = await makeResearch(RESEARCH_A, a.person.id);
  const researchB = await makeResearch(RESEARCH_B, b.person.id);

  return {
    a: { ...a, research: researchA },
    b: { ...b, research: researchB },
  };
};

/**
 * Remove every fixture row.
 *
 * Matches on the exact fixture emails and the exact fixture research titles —
 * both contain FIXTURE_TAG and neither can collide with real content. Deleted
 * in dependency order so foreign keys never block the cleanup.
 */
export const teardownFixtures = async () => {
  const emails = [FACULTY_A.email, FACULTY_B.email];
  const titles = [RESEARCH_A, RESEARCH_B];

  const research = await Research.findAll({ where: { title: titles }, attributes: ['id'] });
  const researchIds = research.map((r) => r.id);

  if (researchIds.length) {
    await ResearchAuthor.destroy({ where: { research_id: researchIds } });
    await Research.destroy({ where: { id: researchIds } });
  }

  const people = await People.findAll({ where: { email: emails }, attributes: ['id'] });
  if (people.length) {
    await ResearchAuthor.destroy({ where: { person_id: people.map((p) => p.id) } });
    await People.destroy({ where: { id: people.map((p) => p.id) } });
  }

  await User.destroy({ where: { email: emails } });

  created.users.length = 0;
  created.people.length = 0;
  created.research.length = 0;
  created.links.length = 0;
};

/** Close the pool so the test process can exit. */
export const closeFixtureConnection = async () => {
  await sequelize.close().catch(() => {});
};

// backend/src/services/assistantScope.js
//
// Subject-scope gating for assistant questions.
//
// This is *defence in depth*, not the access control itself. The real control
// is the WHERE clause built in assistantAccess.js and applied in
// searchService.js: a faculty session physically cannot load another person's
// row, however the question is worded.
//
// What this module adds:
//
//   - An accurate refusal. Without it, "tell me about Dr B's research" in a
//     faculty session retrieves *Faculty A's own* records (the query terms
//     still match something) and the model answers about A — not a leak, but a
//     confusing answer to a question that should simply be declined.
//
//   - A cheap out-of-scope filter, so "write me a Python program" never
//     reaches retrieval or the provider at all.
//
// Both checks are deterministic. None of them are the thing standing between
// a faculty member and another faculty member's data.

import { Op } from 'sequelize';
import { People } from '../db/models/index.js';

/**
 * Requests that are clearly not about this website.
 *
 * Kept narrow on purpose. An over-eager filter that refuses a legitimate
 * department question is a worse failure than one that lets a junk question
 * through to retrieval, where it will find nothing and be refused anyway.
 */
const OFF_TOPIC_PATTERNS = [
  // Code generation and general programming help.
  /\b(write|generate|create|give me|show me)\b.{0,30}\b(a |an |some )?(python|java|c\+\+|javascript|sql|html|code|program|script|function|algorithm)\b/i,
  /\b(debug|fix|refactor|optimi[sz]e)\b.{0,20}\b(my |this |the )?(code|program|script|function)\b/i,
  // General-knowledge tutoring.
  /\b(explain|what is|define|teach me|tell me about)\b.{0,30}\b(machine learning|artificial intelligence|deep learning|blockchain|quantum computing|neural network|calculus|physics|chemistry)\b.{0,20}$/i,
  // Entertainment and personal advice.
  /\b(tell|say)\b.{0,15}\bjoke\b/i,
  /\b(relationship|dating|medical|legal|financial|investment)\b.{0,15}\badvice\b/i,
  /\b(write|compose)\b.{0,20}\b(poem|song|story|essay|email|letter)\b/i,
  // Explicit attempts to invoke general training knowledge.
  /\b(from|using|with)\b.{0,15}\b(your|general)\b.{0,15}\b(training|knowledge|memory)\b/i,
  /\banswer\b.{0,25}\bwithout\b.{0,25}\b(the )?(website|sources?|context|passages?)\b/i,
];

/**
 * Attempts to enumerate people or harvest contact details.
 *
 * Only applied to a faculty session: a public visitor listing published
 * faculty is the website working as intended.
 */
const AGGREGATE_PERSON_PATTERNS = [
  /\b(all|every|each|list of|list the|names of|every single)\b.{0,25}\b(faculty|professor|staff|teacher|member|people|person|employee)/i,
  /\b(faculty|staff|professor|people|member)s?\b.{0,25}\b(list|directory|roster|contact details?|phone numbers?|email addresses?|emails)\b/i,
  /\b(email|phone|contact|mobile|address)\b.{0,25}\b(of (all|every|each|the other)|for (all|every|each))\b/i,
  /\bwho (are|is) the (other )?(faculty|professors|staff|teachers)\b/i,
];

/** Requests for another person, phrased without naming them. */
const OTHER_PERSON_PATTERNS = [
  /\b(other|another|someone else|a different|different)\b.{0,20}\b(faculty|professor|person|member|staff|teacher|colleague)\b/i,
  /\b(colleague|colleagues)('s)?\b.{0,25}\b(research|publication|profile|email|phone|detail|project|patent)/i,
  /\b(private|personal|confidential|hidden|secret)\b.{0,25}\b(detail|information|data|record)s?\b/i,
];

/** Tokens that are too generic to treat as a person's name. */
const NAME_STOPWORDS = new Set([
  'dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'shri', 'smt', 'the', 'and',
  'of', 'department', 'cse', 'lnmiit', 'computer', 'science', 'engineering',
  'faculty', 'staff', 'head', 'assistant', 'associate', 'research', 'scholar',
]);

/** Distinctive name tokens for a person, lowercased. */
const nameTokens = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !NAME_STOPWORDS.has(t));

/**
 * Does the question name a person other than the authenticated one?
 *
 * Only the *names* of other people are read here, and only to compare against
 * the question. No row from this query ever reaches retrieval results, the
 * model context, or the response — it is an authorisation check, not evidence.
 *
 * @param {string} question
 * @param {number} selfPersonId
 * @returns {Promise<boolean>}
 */
export const mentionsAnotherPerson = async (question, selfPersonId) => {
  const haystack = ` ${String(question).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;

  const others = await People.findAll({
    where: { id: { [Op.ne]: selfPersonId } },
    attributes: ['id', 'name'],
  });

  for (const person of others) {
    const tokens = nameTokens(person.name);
    if (!tokens.length) continue;

    // Require a whole-word hit so "Amit" does not match "amitabh" and a
    // surname fragment does not match an unrelated word.
    const hits = tokens.filter((t) => haystack.includes(` ${t} `));

    // A single distinctive token is enough ("tell me about Rajbir"), but the
    // token has to be reasonably specific — short tokens are filtered above.
    if (hits.length >= 1) return true;
  }

  return false;
};

/**
 * Conversational openers: greetings, "who are you", thanks, goodbye.
 *
 * These need handling because the alternative is what users actually hit:
 * "hi" is two characters, so it tripped the minimum-length guard and got
 * "Please ask a question with at least a few characters"; "hey" and "thanks"
 * found no evidence and got "I could not find anything about that on the
 * department website". Both read as broken to someone who has just opened a
 * chat window.
 *
 * Answering these states no facts about the department, so it is not a
 * grounding violation — it is the assistant saying what it is and what to ask.
 * Handling them here also means a greeting never costs a provider call.
 */
const CONVERSATIONAL = [
  {
    kind: 'greeting',
    // Anchored so "hi" matches but "hire a lab" does not, and so a greeting
    // prefixing a real question falls through to retrieval ("hi, what
    // programmes do you offer?"). The optional trailing filler covers
    // "hi there" and "hello everyone", which otherwise fell through to a
    // no-evidence refusal.
    pattern: /^(hi|hey+|hello+|yo|hiya|namaste|greetings|good\s*(morning|afternoon|evening|day))(\s+(there|all|everyone|folks|team|sir|madam|bot))?[\s!.,?]*$/i,
  },
  {
    kind: 'identity',
    pattern: /^(who\s+(are|r)\s+(you|u)|what\s+(are|r)\s+(you|u)|what\s+(can|do)\s+you\s+do|what\s+is\s+this|how\s+do(es)?\s+(you|this)\s+work|help|\?+)[\s!.,?]*$/i,
  },
  {
    kind: 'thanks',
    pattern: /^(thanks?|thank\s*(you|u)|thx|ty|cheers|great|nice|cool|ok(ay)?|got\s*it)[\s!.,?]*$/i,
  },
  {
    kind: 'farewell',
    pattern: /^(bye+|goodbye|see\s*(you|ya)|cya|good\s*night)[\s!.,?]*$/i,
  },
];

/**
 * Detect a conversational opener.
 *
 * @returns {{kind: string}|null}
 */
export const classifyConversational = (question) => {
  const trimmed = String(question || '').trim();

  // A long message is a real question even if it starts with "hi".
  if (!trimmed || trimmed.length > 40) return null;

  for (const entry of CONVERSATIONAL) {
    if (entry.pattern.test(trimmed)) return { kind: entry.kind };
  }

  return null;
};

/**
 * Classify a question before any retrieval happens.
 *
 * @param {string} question  Already sanitised.
 * @param {object} accessScope  From resolveAccessScope.
 * @returns {Promise<{allowed: boolean, reason: string|null, message: string|null}>}
 */
export const classifyQuestion = async (question, accessScope) => {
  const OFF_TOPIC_MESSAGE =
    'I can help with questions related to the LNMIIT CSE Department website. ' +
    'Please ask me something about the department, its programmes, faculty, ' +
    'research, events, or other published information.';

  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(question)) {
      return { allowed: false, reason: 'off_topic', message: OFF_TOPIC_MESSAGE };
    }
  }

  // Everything below applies only to an authenticated faculty session.
  if (accessScope.scope !== 'faculty_self') {
    return { allowed: true, reason: null, message: null };
  }

  const SELF_ONLY_MESSAGE =
    'While you are signed in, I can only answer questions about your own ' +
    'profile, research, publications and projects. I cannot look up other ' +
    'people or departmental contact lists from here. Sign out to browse the ' +
    'public website, or use the department directory page.';

  for (const pattern of AGGREGATE_PERSON_PATTERNS) {
    if (pattern.test(question)) {
      return { allowed: false, reason: 'aggregate_person_request', message: SELF_ONLY_MESSAGE };
    }
  }

  for (const pattern of OTHER_PERSON_PATTERNS) {
    if (pattern.test(question)) {
      return { allowed: false, reason: 'other_person_request', message: SELF_ONLY_MESSAGE };
    }
  }

  if (await mentionsAnotherPerson(question, accessScope.personId)) {
    // Phrased as a scope limit, not as confirmation that the named person
    // exists or that any record was found.
    return { allowed: false, reason: 'named_other_person', message: SELF_ONLY_MESSAGE };
  }

  return { allowed: true, reason: null, message: null };
};

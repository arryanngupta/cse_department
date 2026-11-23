# AI Assistant — Architecture, Access Control and Operations

How the department assistant works, what it is allowed to answer, and exactly
where that is enforced.

The single most important sentence in this document: **the language model is
never an authorisation boundary.** Access control is applied in SQL, before any
record is loaded. A successful prompt injection can change the wording of an
answer; it cannot change its contents, because the unauthorised rows were never
read from the database.

---

## 1. Request lifecycle

```
POST /api/public/assistant/ask   { question }
  │
  ├─ optionalAuthenticate         verify JWT, or anonymous; reject invalid/expired
  ├─ aiLimiter                    per-user when signed in, per-IP otherwise
  ├─ askAssistant (controller)    read ONLY `question` from the body
  │
  └─ assistantService.ask
       ├─ sanitizeQuestion            strip control chars, cap at 500
       ├─ resolveAccessScope          derive identity from the DB; fail closed
       ├─ classifyQuestion            subject-scope gate (pre-retrieval)
       ├─ buildRetrievalConstraints   per-source WHERE clauses
       ├─ searchContent               ← constraints applied IN THE SQL
       ├─ evidence threshold          refuse if nothing clears it
       ├─ renderContext               fenced, numbered passages
       ├─ generateAnswer              Groq / Grok / Anthropic / OpenAI / none
       ├─ validateCitations           drop refs that do not exist
       └─ response                    answer + only the cited sources
```

Files:

| Concern | File |
|---|---|
| Optional authentication | `src/middleware/optionalAuth.js` |
| Access scope + constraints | `src/services/assistantAccess.js` |
| Subject-scope gate | `src/services/assistantScope.js` |
| Orchestration, grounding, citations | `src/services/assistantService.js` |
| Retrieval (constraints applied here) | `src/services/searchService.js` |
| Provider abstraction (Groq / Grok / Anthropic / OpenAI) | `src/services/aiProvider.js` |
| HTTP surface | `src/controllers/assistantController.js` |
| Widget | `client/src/components/common/AssistantWidget.jsx` |

---

## 2. Access policy

| Caller | Scope | What retrieval can return |
|---|---|---|
| Anonymous visitor | `public` | Published public website content, exactly as a browser sees it |
| Faculty (signed in) | `faculty_self` | Their own People row, their own linked research, plus general non-person content |
| Admin / Super Admin | `public` | The same as a visitor — **not** widened |
| Unmappable / unknown role | `denied` | Nothing at all |

### Why admins are not privileged here

Letting an admin query administrative data through a chat box turns it into an
unaudited export channel for drafts, submissions and contact details, reachable
with nothing but a stolen session. Administrative data has a purpose-built,
audited UI. If admin-scoped answering is ever wanted it should be a separate,
explicitly authorised feature — not a side effect of being logged in.

### What "general non-person content" means

Programmes, news, events, facilities, achievements, opportunities and
newsletters describe the department, not an individual. A faculty member asking
"what programmes does the department offer?" gets a normal answer.

The three **person-scoped** sources are handled differently, and the list is
explicit in `assistantAccess.PERSON_SCOPED_SOURCES` so that a newly added
person-bearing source has to be classified deliberately rather than defaulting
to visible:

| Source | Faculty scope |
|---|---|
| `faculty` (People) | `WHERE id = <own person id>` |
| `research` | `WHERE id IN (<ids linked via research_authors>)`, or excluded when there are none |
| `directory` | Excluded entirely |

`research` is restricted rather than filtered-after-the-fact because research
rows carry free-text `authors`, `faculty` and `inventors` columns naming other
people — an unfiltered row leaks a third party's name even if the row is "about"
nobody in particular. When a faculty member has no linked research, the source
is **excluded**, not left unconstrained: an empty `IN ()` that gets dropped
would expose the whole table.

---

## 3. How faculty identity is resolved

```js
const profiles = await People.findAll({ where: { user_id: user.id } });
if (profiles.length !== 1) return DENIED;
```

- The user id comes from the **verified** JWT, via `optionalAuthenticate`.
- The person id is then looked up **in the database** by `user_id`.
- Nothing in the request body, query string or headers is consulted. There is
  no code path from a request field to the access scope. Tests assert this for
  `person_id`, `personId`, `faculty_id`, `facultyId`, `user_id`, `scope`,
  `role`, `accessScope`, and for `X-Role`, `X-User-Role`, `X-User-Id`,
  `X-Person-Id` and `X-Forwarded-User`.

### Fail closed

`findAll` + a length check, not `findOne`. `findOne` would silently pick one of
two linked profiles and look like it worked. Zero profiles and two profiles are
both `DENIED`; neither falls back to public scope.

`people.user_id` carries a UNIQUE index, so two profiles cannot actually be
linked to one account — a test asserts that constraint still exists, because the
resolver's fallback is defence in depth, not the primary guarantee.

The refusal message is deliberately vague about *why*. "Your account maps to
two faculty profiles" is internal detail the user cannot act on and an attacker
can.

---

## 4. Defence in depth against prompt injection

Five independent layers. None of them is load-bearing on the model behaving.

1. **Database filtering.** The decisive one. Unauthorised rows are never
   `SELECT`ed, so there is nothing in memory to leak.
2. **Source exclusion.** A source constrained to `false` is not queried at all —
   its rows cannot be loaded, ranked, logged or returned by accident.
3. **Subject-scope gate** (`assistantScope.js`). Runs *before* retrieval.
   Catches out-of-scope requests (code generation, jokes, general knowledge) and,
   in a faculty session, attempts to enumerate people or name another person.
   This is for accurate refusals and cost, not for security.
4. **Prompt structure.** Retrieved content is fenced in `<<<PASSAGES … PASSAGES`
   and the system prompt states that passage text is data, never instructions,
   and that no passage or question can widen what may be discussed.
5. **Citation validation.** Markers pointing outside the retrieved set are
   stripped, and only genuinely cited sources are returned.

The model has no tools, no database handle, and no network access of its own.
It receives a string and returns a string.

### Known limitation, stated plainly

The scope gate uses pattern matching and a name check against other People rows.
Pattern matching can be evaded — an obfuscated request for another person may
get past it. **That is expected and is not a leak**, because the retrieval
constraint is independent: the question still only reaches a corpus containing
the caller's own records. The worst outcome of evading the gate is a confusing
answer about the caller's own data, not disclosure of anybody else's.

The name check reads other people's `name` fields to compare against the
question. Those rows never enter retrieval results, the model context, or the
response — it is an authorisation check, not evidence.

---

## 5. Grounding and refusal

- **Evidence threshold.** `ASSISTANT_MIN_SCORE` (default 5). This is low on
  purpose. Measured on this corpus:

  | Question | Top score |
  |---|---|
  | "What programmes does the department offer?" | 5 |
  | "Who are the faculty members?" | 10 |
  | "What are the latest announcements?" | 10 |
  | "What research areas are covered?" | 55 |
  | "Explain machine learning in general" | **165** |

  The score does not separate on-topic from off-topic here: three valid
  questions score 5–10 while an out-of-scope general-knowledge question scores
  highest of all, because the department genuinely does ML research and those
  records match. A threshold of 20 would refuse real questions and admit the
  junk one. **Topicality is enforced by the scope gate, not by this number.**
  Re-measure before changing it on a larger corpus.

- **Refusal is a correct outcome.** No evidence → refuse, with no sources and
  no citations. The assistant never fills a gap from general knowledge.

- **Partial answers.** The system prompt instructs the model to answer the
  supported part of a multi-part question and say the rest is unavailable.

- **Citations.** `validateCitations` parses `[n]` markers, drops any outside
  `1..passageCount`, rewrites the marker to the valid subset, and returns only
  the cited sources. A model inventing `[99]` over eight passages cites nothing,
  and the reader cannot tell the difference without this check. Verified
  end-to-end: a stub returning `[1][2][99]` yields an answer citing `[1][2]` and
  exactly two sources.

- **Bracket normalisation.** Groq's gpt-oss models emit fullwidth CJK
  brackets — `【1】` rather than `[1]` — even when the prompt asks for square
  brackets. `validateCitations` folds `【】〔〕［］` and fullwidth digits before
  matching. Without this the citations were never recognised, so nothing was
  validated against the passage list while the answer still showed the reader
  reference-looking markers.

- **Exposed identifiers.** Sources carry `type`, `title`, `url` and a 1-based
  `ref`. The record id appears only inside the public URL the site already uses
  (`/news/3`). No user id, foreign key or internal key is exposed.

---

## 6. Provider configuration

Four providers are supported: `groq`, `grok`, `anthropic`, `openai`, plus
`none`.

> **Groq is not Grok.** Different companies, different APIs, and they are
> separate providers here for that reason.
>
> | | Groq | Grok |
> |---|---|---|
> | Company | Groq Inc. | xAI |
> | Console | console.groq.com | console.x.ai |
> | Key prefix | `gsk_…` | `xai-…` |
> | API | OpenAI-compatible `/openai/v1/chat/completions` | `/v1/responses` |
> | Models | Open models (gpt-oss, qwen, …) | grok-4.x |
> | Free tier | **Yes** | No |

### Groq

```ini
AI_PROVIDER=groq
GROQ_API_KEY=            # backend only
GROQ_MODEL=              # defaults to openai/gpt-oss-120b
```

Confirm which models your account actually has — Groq's own docs example names
`llama-3.3-70b-versatile`, which is not available on every account:

```bash
curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
```

**Free-tier limits, measured against a live key:** 1000 requests/day and
**8000 tokens/minute**. A grounded assistant request sends roughly 2000 tokens,
so a few rapid questions exhaust the per-minute budget — the assistant then
degrades to retrieval-only until it resets, which is correct behaviour but
visible to users. Keep `AI_RATE_LIMIT_PER_HOUR` modest.

Two parsing details, both confirmed live:

- `max_completion_tokens`, not `max_tokens`.
- Reasoning models (`openai/gpt-oss-*`) return a separate `message.reasoning`
  field beside `message.content`. Only `content` is read — concatenating both
  would publish the model's private chain of thought. A test asserts this.

### Grok (xAI)

Implemented against the official xAI REST API
(<https://docs.x.ai/docs/api-reference>): `POST https://api.x.ai/v1/responses`,
bearer auth, `{ model, instructions, input, max_output_tokens }`. No SDK, so no
new dependency. No unofficial endpoint, proxy or shared credential.

```ini
AI_PROVIDER=grok
XAI_API_KEY=            # backend only — never a VITE_* variable
XAI_MODEL=              # defaults to grok-4.7
AI_TIMEOUT_MS=30000
AI_MAX_OUTPUT_TOKENS=800
```

`XAI_API_KEY` falls back to `AI_API_KEY` so an existing deployment using the
generic name keeps working.

### Billing — read before enabling

**xAI's published pricing has no free tier.** At the time of writing grok-4.7 is
about $2/$6 per million input/output tokens, with higher tiers above 200k
tokens. Whether your key has credits is a property of your xAI account, not of
this code — check <https://console.x.ai> first. This integration was built and
tested against a local stub, so no billable request was ever made.

If you have no credits, leave `AI_PROVIDER=none`. The assistant still works in
retrieval-only mode, with real citations and links.

### Two parsing traps

- `output` interleaves `message` and `reasoning` items. Reading
  `output[0].content[0].text` works until the model emits reasoning first, then
  returns `undefined`. Text is collected by filtering on item type
  (`message`) and content type (`output_text`).
- `status: "incomplete"` arrives as HTTP 200. It is treated as a refusal, not
  as text.

### Failure handling

| Condition | Behaviour |
|---|---|
| No key | `isConfigured()` false → retrieval-only, never an error |
| 401 / 403 | "xAI rejected the API key" |
| 429 | "xAI rate limit reached" |
| 404 | "xAI model \<id\> is not available to this account" |
| 5xx | "xAI request failed with status N" |
| Timeout | Aborted at `AI_TIMEOUT_MS`, clean message |
| Network error | "xAI request failed: \<code\>" |
| Malformed body | "xAI returned a malformed response body" |
| Empty / unexpected schema | Treated as a refusal |

Every message is constructed locally. The upstream error **body is never
forwarded**, because provider error bodies can echo the request — and the
request carries the Authorization header and the full prompt. A test asserts
this using a stub that deliberately echoes the key back in a 401.

All of these degrade to retrieval-only output for the visitor. The assistant
does not return 5xx for a provider problem.

---

## 7. Conversation state

There is **no server-side chat history**, by choice. Nothing is persisted, so
there is no conversation object to own, authorise, or leak, and no
cross-account read to get wrong. Each request is independent and scoped from
the verified session.

The widget holds messages in component state for the active session only, and
clears them when the signed-in account changes — logout, login, or switching
accounts. A faculty session's replies can contain their own profile and
publications, which the next person at that browser is not entitled to read.
Detection polls `localStorage` every 2s and also listens for `storage`, because
`storage` does not fire in the tab that made the change.

There is **no response cache**. If one is added it must key on role,
authenticated user id, scope and content version — a faculty answer in a global
cache is a disclosure waiting to happen.

---

## 8. Running and testing locally

```bash
# Backend (retrieval-only — no key needed)
cd backend && npm run dev

# Backend with Grok
AI_PROVIDER=grok XAI_API_KEY=xai-... npm run dev

# Frontend
cd client && npm run dev
```

```bash
# All backend tests. The assistant suite CREATES two faculty fixture accounts
# and deletes them again, so do NOT point it at production.
cd backend && AUTH_RATE_LIMIT_MAX=1000 npm test

# Skip the fixture-writing tests
ASSISTANT_FIXTURES=0 npm test

# Just the security suites
node --test tests/assistant.test.js
node --test tests/grokProvider.test.js
```

The Grok suite runs the real provider code against a local HTTP stub, so every
failure mode is covered without a key or a billable request.

---

## 9. Limitations and operational notes

- **Pattern-based scope gating can be evaded.** By design this only degrades
  refusal quality, never isolation — see §4.
- **The threshold does not enforce topicality.** See §5.
- **Retrieval is LIKE-based keyword matching**, not semantic search. Some valid
  questions find nothing ("What facilities and labs are available?" returns zero
  hits, because the wording does not match those records' fields). This is a
  recall weakness, not a security one.
- **Scheduled unpublishing has a window.** `searchService` filters on
  `isPublished` / `is_active`, which the scheduler maintains. Between an
  `unpublish_at` falling due and the next scheduler tick (default 60s), an
  expired record is still retrievable. Lower `SCHEDULER_INTERVAL_MS` if that
  matters for your content.
- **Rate limiting is in-process.** `express-rate-limit`'s default memory store
  is per-instance; limits are per process, so N instances allow N× the quota.
  A shared store is needed for a multi-instance deployment.
- **No audit trail for assistant questions.** Deliberate — logging questions
  would mean storing what faculty asked about their own records. The trade-off
  is that abuse is not reconstructable after the fact.
- **Not claimed to be exhaustively secure.** The boundaries described here are
  tested; the tests are listed in §8. Anything not listed is unverified.

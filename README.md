# LNMIIT CSE Department Website

Full-stack, CMS-driven website for the Department of Computer Science &
Engineering at The LNM Institute of Information Technology, Jaipur.

React 19 + Vite frontend, Express 5 + Sequelize backend, MySQL 8, Cloudinary
media, JWT auth with role-based access control, site-wide search, and a
retrieval-grounded AI assistant.

---

## Documentation

| | |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Start here — what the project is, every feature, scale, known gaps |
| [docs/architecture.md](docs/architecture.md) | System design, auth/RBAC, search, AI assistant internals |
| [docs/assistant-security.md](docs/assistant-security.md) | Assistant access control, faculty isolation, Grok setup |
| [docs/database-migration.md](docs/database-migration.md) | Backup, local→cloud migration, verification, rollback |
| [docs/deployment.md](docs/deployment.md) | Render, Vercel, domain, environment separation |
| [docs/admin-guide.md](docs/admin-guide.md) | Guide for department staff — no coding required |

---

## Features

**Public site** — homepage with dynamic hero slider; faculty, staff, research
scholars and alumni directories with filtering and individual profiles;
B.Tech / M.Tech / PhD programme pages with curriculum, semesters, courses and
outcomes; research publications, projects, patents and collaborations; news and
events; facilities; opportunities and careers; newsletter PDFs; department
phone directory; mega-menu navigation; 21-language translation (12 Indian, 8 international);
SEO metadata and
sitemap.

**Site-wide search** — one search box across ten content types, with
suggestions, match highlighting, category filters, pagination and relevance
ranking.

**Research authorship** — publications, projects and patents linked
relationally to faculty, so a profile lists its own work and a paper links back
to its authors. External co-authors supported.

**Event registration** — opt-in per event, with capacity, waitlisting,
deadlines, duplicate protection, and a CSV export hardened against spreadsheet
formula injection.

**Audit log** — every content change and sign-in recorded with actor, action,
resource and changed field names. Read-only; secrets are never logged.

**AI assistant** — a floating assistant answering questions from published
department content only, with validated source citations. Supports Groq, Grok
(xAI), Anthropic and OpenAI, and degrades to retrieval-only when no key is
configured.

Access control is applied in SQL before any record is loaded, never by the
model. An anonymous visitor sees published public content; a signed-in faculty
member sees **only their own** profile and relationally-linked research, and
cannot reach another person's record however the question is worded; admins are
deliberately not privileged here. An account that cannot be mapped to exactly
one faculty profile is refused rather than downgraded. See
[docs/assistant-security.md](docs/assistant-security.md).

**Admin panel** — JWT login, three roles (Super Admin / Admin / Faculty),
full CMS for every content type, Cloudinary image and PDF uploads, draft vs
published control, and faculty self-service profile editing.

**Content versioning** — every admin update, delete and restore across ten
entities is snapshotted, diffed field by field, and restorable. A restore is
itself versioned, so it can be undone.

**Scheduled publishing** — `publish_at` / `unpublish_at` on news, events,
achievements, opportunities and facilities. Schedules are stored as database
columns and applied by a polling worker, not in-memory timers, so a restart
cannot lose them; the worker ticks once on boot to catch up on anything that
came due while the process was down.

**Content approval workflow** — faculty submit changes as drafts; an admin
reviews, approves or rejects with a required note. Approval applies the payload
in a transaction and records a version. Protected fields (ids, timestamps,
password hashes, slugs) can never be set through a submission.

**CSV import** — people, directory, research and achievements. A dry-run
preview reports per-row errors and warnings and writes nothing; applying runs in
a single transaction and refuses outright if any row is invalid unless partial
import is explicitly requested. The parser is RFC 4180 (quoted fields, embedded
commas and newlines, CRLF, BOM).

**Media library** — catalogues every image and PDF referenced across eleven
model columns, shows where each asset is used, and refuses to delete one that is
still referenced. Also reports broken references.

**Dashboard analytics** — headline counts, a twelve-month content trend chart
(hand-rolled inline SVG, with the same data in a visually-hidden table for
screen readers), research mix by category, admin activity from the audit log,
and actionable content-health checks. Every figure is counted from real rows.

**Email** — transactional mail via SMTP or Resend for event-registration
confirmations and password resets. With no provider configured, sends are
logged no-ops: the app never fails because mail is unconfigured.

**Password reset** — self-service reset by emailed link. Only the SHA-256 hash
of each single-use token is stored, and the request endpoint returns the same
response whether or not the address exists, so it cannot be used to enumerate
accounts.

**SEO and accessibility** — per-route canonical URLs, Open Graph and Twitter
cards, and schema.org JSON-LD (`CollegeOrUniversity`, `Person`, `Event`,
`NewsArticle`, `Course`, `BreadcrumbList`) built only from fields that actually
exist on the record. Skip-to-content link, named landmarks, visible focus
indicators, `prefers-reduced-motion` support, and a WCAG AA contrast pass.
Route-level code splitting keeps the initial bundle under 450 kB.

---

## Prerequisites

Node.js 20+, MySQL 8+, npm.

---

## Local setup

```bash
git clone <repository-url>
cd Cse-Department
```

### Backend

```bash
cd backend
npm install

cp ../.env.sample .env     # then fill it in — see below
npm run migrate            # create the schema
npm run seed               # optional: reference data + default admin
npm run dev                # http://localhost:3022
```

Minimum `backend/.env` for local development:

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=lnmiit_cse
DB_SSL=false

# Required. Generate with: openssl rand -hex 32
JWT_SECRET=<64 hex characters>

PORT=3022
NODE_ENV=development
ORIGIN=http://localhost:3021

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

AI_PROVIDER=none
```

The server **will not start** without `JWT_SECRET` or the four `DB_*` values.
That is deliberate: there are no in-source credential fallbacks, because a
fallback secret in a tracked file is both a credential leak and a way for
production to boot against the wrong database.

### Frontend

```bash
cd client
npm install
echo 'VITE_API_BASE_URL=http://localhost:3022' > .env
npm run dev                # http://localhost:3021
```

No trailing slash on `VITE_API_BASE_URL` — the API client appends `/api`.

### Default login

```
admin@lnmiit.ac.in / Admin@123
```

Change it immediately; it is published here.

---

## Environment variables

[`.env.sample`](.env.sample) documents every variable with its default and
purpose. Highlights:

| Variable | Notes |
|---|---|
| `DB_SSL` | Defaults to on when `NODE_ENV=production`. Opting out requires `DB_SSL=false` explicitly, so an unset value cannot silently downgrade production to an unencrypted connection. |
| `DB_SSL_CA` | Optional PEM. When set, the certificate chain is fully verified rather than merely encrypted. |
| `JWT_SECRET` | Required, minimum 32 characters. |
| `ORIGIN` | Comma-separated **exact** origins. Wildcards are rejected; production fails to start if unset. |
| `AI_PROVIDER` | `groq`, `grok`, `anthropic`, `openai`, or `none`. With `none` the assistant runs retrieval-only. **`groq` and `grok` are different providers, not a typo.** |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq credentials and model (default `openai/gpt-oss-120b`). Backend only. Groq has a free tier: 1000 req/day, 8000 tokens/min. |
| `XAI_API_KEY` / `XAI_MODEL` | Grok credentials and model (default `grok-4.7`). Backend only. xAI has **no free tier** — check console.x.ai for credits before enabling. |
| `AI_API_KEY` | Server-side only. Never expose a key through a `VITE_*` variable — those are compiled into the browser bundle. |
| `EMAIL_PROVIDER` | `smtp`, `resend`, or `none`. With `none`, sends are logged no-ops — the app never fails because mail is unconfigured. |
| `EMAIL_FROM` | Required once a provider is set. `EMAIL_FROM_NAME` is optional. |
| `SMTP_*` | Host, port, secure flag and credentials. Only read when `EMAIL_PROVIDER=smtp`. |
| `RESEND_API_KEY` | Only read when `EMAIL_PROVIDER=resend`. |
| `PASSWORD_RESET_TTL_MINUTES` | Default 60. Tokens are single-use and stored only as a SHA-256 hash. |
| `SCHEDULER_ENABLED` | Default on. Set `false` to stop this instance applying due schedules — useful when running several instances and only one should own the job. |
| `SCHEDULER_INTERVAL_MS` | Default 60000. The worker also ticks once on boot to catch up. |
| `AUTH_RATE_LIMIT_MAX` | Login attempts per window. Raise it in CI: the test suite deliberately performs failed logins and would otherwise lock itself out of reruns. |
| `VITE_SITE_URL` | Public origin of the site. Builds canonical URLs, Open Graph tags and JSON-LD — a wrong value points every canonical tag at the wrong host. |

---

## Scripts

**Backend**

| | |
|---|---|
| `npm run dev` | Watch mode |
| `npm start` | Production |
| `npm run migrate` | Apply migrations (idempotent) |
| `npm run migrate:down` | Revert |
| `npm run seed` | Seed reference data |
| `npm run reset` | Down, up, seed — **destructive** |
| `npm test` | API, RBAC and security suite against a running server |

**Frontend**

| | |
|---|---|
| `npm run dev` / `npm run build` / `npm run preview` | Vite |
| `npm run lint` | ESLint |

**Operational**

| | |
|---|---|
| `backend/scripts/db-verify.mjs` | Compare two databases: schema, row counts, FKs, auto-increment, charset |
| `backend/scripts/migrate-to-cloud.sh` | Backup → import → verify, with a refuse-to-overwrite guard |
| `backend/scripts/backfill-research-authors.mjs` | Propose research↔faculty links from existing free text. Dry-run by default; `--apply` to write |

---

## Testing

The suite runs against a **live** backend, so it exercises the real middleware
stack — CORS, rate limiting, error handling — not just route handlers.

> ⚠️ **`tests/api.test.js` is read-only and safe against production.
> `tests/features.test.js` is not** — it creates authorship links, opens event
> registration, and registers attendees. It cleans up after itself, but point
> it at a development instance.

```bash
cd backend
npm run dev                                  # in one terminal
npm test                                     # in another

BASE_URL=https://api.example.com npm test    # or against a deployment
```

79 tests cover health and readiness, all ten public endpoints, search
(including ranking order, LIKE-wildcard escaping and category filters), the AI
assistant (including a prompt-injection regression test), authentication,
RBAC for anonymous/forged/valid tokens, security headers plus the guarantee
that errors never leak SQL or schema details, and the research-authorship,
event-registration and audit-log features (including CSV formula-injection
escaping and the guarantee that no secret reaches the audit log).

The suite deliberately performs failed logins, so run the server under test
with `AUTH_RATE_LIMIT_MAX` raised (e.g. `1000`) — otherwise the login limiter
locks out reruns for 15 minutes:

```bash
AUTH_RATE_LIMIT_MAX=1000 npm run dev
```

---

## API

### Public

```
GET  /health                     liveness (no database dependency)
GET  /ready                      readiness (includes database check)

GET  /api/sliders
GET  /api/people                 ?person_type=Faculty
GET  /api/people/:slug
GET  /api/programs               /api/programs/:id
GET  /api/news                   /api/news/:id
GET  /api/events                 /api/events/:id
GET  /api/achievements           /api/achievements/:id
GET  /api/research               /api/research/:id
GET  /api/facilities             /api/facilities/:id
GET  /api/opportunities          /api/opportunities/:id
GET  /api/newsletters
GET  /api/directory
GET  /api/info/:key

GET  /api/search                 ?q=&categories=&limit=&offset=
GET  /api/search/suggestions     ?q=
GET  /api/search/categories

GET  /api/assistant/status
POST /api/assistant/ask          { question }

GET  /api/events/:id/registration    registration status (counts only)
POST /api/events/:id/register        { name, email, phone?, affiliation?, notes? }
```

### Auth

```
POST /api/auth/login             { email, password }
GET  /api/auth/me
POST /api/auth/change-password   { password }   ← sets the caller's own password

POST /api/auth/forgot-password   { email }     → always the same response
GET  /api/auth/reset-password/:token           → token validity only
POST /api/auth/reset-password    { token, password }
```

### Admin — `/api/admin/*`, JWT required

Full CRUD for sliders, people, programs (plus sections, semesters, courses,
outcomes), news, events, achievements, newsletters, directory, info-blocks,
research, facilities and opportunities.

```
GET    /analytics/overview                 headline counts
GET    /analytics/trends?months=12          content created per month
GET    /analytics/activity?days=30          admin activity from the audit log
GET    /analytics/health                    actionable content-quality checks

GET    /versions/recent                     latest changes across all entities
GET    /versions/:resource/:id               version history for one record
GET    /versions/:resource/:id/:version       one snapshot, with a diff
POST   /versions/:resource/:id/:version/restore

GET    /schedule/:resource/:id              current publish window
PUT    /schedule/:resource/:id              { publish_at, unpublish_at }
                                            or { publish_now: true } to clear the
                                            schedule and go live in one step
POST   /schedule/run                        apply due schedules now

GET    /submissions                         review queue
POST   /submissions                         { resource, resource_id, payload }
POST   /submissions/:id/review              { decision: "approve" | "reject", note }
                                            admin only; `note` is required to reject,
                                            and a reviewed submission returns 409

GET    /import/options                      importable resources and columns
GET    /import/:resource/template           CSV template
POST   /import/:resource/preview            dry run; writes nothing
POST   /import/:resource/apply              single transaction

GET    /media                               asset catalogue
POST   /media/sync                          rebuild from current references
GET    /media/:id/usage                     where an asset is referenced
GET    /media/broken-references             references with no asset
DELETE /media/:id                           refused while still referenced
```

`/submissions` is deliberately not behind `requireAdmin` — faculty need to
create and read their own. Per-action authorisation lives in the controller, and
`/submissions/:id/review` is admin-only.

---

## Project structure

```
.
├── backend/
│   ├── scripts/            migrate.js, db-verify.mjs, migrate-to-cloud.sh
│   ├── src/
│   │   ├── config/         auth, database, cloudinary, multer
│   │   ├── controllers/
│   │   ├── db/             migrations, models, seeders
│   │   ├── middleware/     auth, rbac, errorHandler, rateLimiter
│   │   ├── routes/         public, admin, auth, sitemap
│   │   ├── services/       searchService, assistantService, aiProvider
│   │   └── index.js
│   └── tests/
├── client/
│   └── src/
│       ├── components/     + common/SearchBox, AssistantWidget
│       ├── pages/          + SearchResults
│       └── lib/api.js
├── docs/
└── .env.sample
```

---

## Security

- bcrypt password hashing; JWT with a required, length-validated secret
- Server-side authorization on every protected route — the UI never enforces
  access
- Helmet security headers; `x-powered-by` disabled
- Strict CORS allowlist (exact origins; no wildcards)
- Rate limiting: login (10 failed / 15 min), API (600 / 15 min), uploads
  (50 / hour), assistant (30 / hour)
- 1 MB request body cap
- Upload type validation (images and PDFs)
- Parameterized queries throughout Sequelize; LIKE wildcards escaped in search
- Errors return a correlation id, never SQL or schema details
- Prompt-injection protections on the AI assistant, with a regression test
- TLS enforced for production database connections
- Graceful shutdown so redeploys do not cut responses mid-write

Report vulnerabilities to the department's web maintainer rather than opening a
public issue.

---

## Troubleshooting

**`Missing required database environment variable(s)`** — copy `.env.sample`
to `backend/.env` and fill in the `DB_*` values.

**`JWT_SECRET is not set`** — `openssl rand -hex 32` and add it.

**`getaddrinfo ENOTFOUND`** — `DB_HOST` is wrong or the database no longer
exists. See [docs/database-migration.md](docs/database-migration.md).

**CORS errors in the browser** — add the frontend origin to `ORIGIN`
(comma-separated, exact).

**Port already in use**

```bash
lsof -ti:3022 | xargs kill -9
lsof -ti:3021 | xargs kill -9
```

**Endpoint returns 500 with an `errorId`** — the detail is in the server log
under that id; responses deliberately omit it.

---

## License

Proprietary — LNMIIT CSE Department.

# LNMIIT CSE Department — Project Overview

A single document describing what this project is, what it does, how it is
built, and what is still outstanding.

For task-specific detail see [`README.md`](README.md) (setup and API),
[`docs/architecture.md`](docs/architecture.md) (design decisions),
[`docs/admin-guide.md`](docs/admin-guide.md) (for department staff),
[`docs/deployment.md`](docs/deployment.md) and
[`docs/database-migration.md`](docs/database-migration.md).

---

## 1. What it is

A full-stack, CMS-driven website for the Department of Computer Science &
Engineering at The LNM Institute of Information Technology, Jaipur.

Department staff manage every piece of content — faculty profiles, programmes
and curricula, research, news, events, achievements, facilities, newsletters
and the phone directory — through an admin panel. Nothing visitor-facing is
hard-coded.

**Two applications, one repository:**

| | Port | Stack |
|---|---|---|
| `client/` | 3021 | React 19.2, Vite 7.1, Tailwind CSS 4.1, React Router 7 |
| `backend/` | 3022 | Express 5.1, Sequelize 6.37, MySQL 8, ES modules |

Media is hosted on Cloudinary. Authentication is JWT + bcrypt with role-based
access control.

---

## 2. Scale

Measured from the current working tree, not estimated:

| | |
|---|---|
| Backend source files | 104 |
| Frontend source files | 89 |
| Sequelize models | 22 |
| Migrations | 33 |
| Database tables | 28 |
| Public page components | 19 |
| Admin page components | 23 |
| Public API routes | 28 |
| Admin API routes | 101 |
| Auth routes | 6 |
| Automated tests | 79 (all passing) |
| Production bundle | 432 kB (140 kB gzip), 50+ chunks |

---

## 3. Features

### Public site

- Homepage with a CMS-managed hero carousel
- Faculty, staff, research scholar and alumni directories, with filtering and
  individual profile pages
- B.Tech / M.Tech / Ph.D. programme pages with curriculum, semesters, courses
  and programme outcomes
- Research: publications, projects, patents and collaborations
- News, events, achievements (with category tabs), facilities, opportunities,
  newsletter PDFs, departmental phone directory
- Mega-menu navigation, English/Hindi language toggle
- Sitemap and `robots.txt`

### Site-wide search

One search box covering ten content types, with type-ahead suggestions,
match highlighting, category filter chips showing per-type counts, pagination
and relevance ranking.

### AI assistant

A floating assistant that answers visitor questions from **published**
department content only, with inline source citations. Retrieval-grounded, not
fine-tuned. With no API key configured it still runs — answering from the
retrieval layer with citations and simply not generating prose. It never
returns an error page.

### Research authorship

Publications, projects and patents are linked relationally to faculty, so a
profile lists its own work and a paper links back to its authors. External
co-authors are supported without requiring a `people` record.

### Event registration

Opt-in per event, with capacity, waitlisting, deadlines and duplicate
protection. The CSV export is hardened against spreadsheet formula injection
(`=`, `+`, `-`, `@`, tab, CR).

### Admin panel

JWT login, three roles (Super Admin / Admin / Faculty), full CRUD for every
content type, Cloudinary uploads, draft-versus-published control, and faculty
self-service profile editing.

Beneath the per-type content sections, the sidebar has a **Tools** group:

| Screen | What it does |
|---|---|
| **Submissions** | Review queue for faculty-submitted changes |
| **Scheduled** | Upcoming publish / unpublish windows |
| **Media Library** | Every referenced image and PDF, and where each is used |
| **Import CSV** | Bulk import with a dry-run preview |
| **Change History** | Field-level diffs and restore |
| **Audit Log** | Read-only trail of every change and sign-in |

### Content versioning

Every admin update, delete and restore across ten entities is snapshotted,
diffed field by field, and restorable. **A restore is itself versioned**, so it
can be undone. Restoring into a record that has since been deleted is refused
(409) rather than recreating it at the same ID, because reusing an ID silently
reattaches every foreign key that pointed at the old row.

### Scheduled publishing

`publish_at` / `unpublish_at` on news, events, achievements, opportunities and
facilities. Schedules are **database columns applied by a polling worker**, not
in-memory timers — a restart cannot lose them, and the worker ticks once on boot
to catch up on anything that came due while the process was down.

### Content approval workflow

Faculty submit changes; an admin approves or rejects with a required note.
Approval applies the payload in a transaction and records a version, so an
approved submission is as revertible as a direct edit. Protected fields (IDs,
timestamps, account links, password hashes, slugs) are stripped from every
payload — a submission is untrusted input from a lower-privileged role.

### CSV import

People, directory, research and achievements. A dry-run preview validates
every row and writes nothing; applying runs in a single transaction and refuses
outright if any row is invalid, unless partial import is explicitly requested.
The parser is RFC 4180: quoted fields, `""` escapes, embedded commas and
newlines, CRLF, BOM stripping.

### Media library

Catalogues every image and PDF referenced across eleven model columns, reports
where each asset is used, and refuses to delete one that is still referenced.
It never deletes the file from Cloudinary — an index should not be able to
destroy the thing it indexes. Also reports broken references.

### Dashboard analytics

Headline counts, a twelve-month content trend chart, research mix by category,
admin activity from the audit log, and actionable content-health checks
(faculty without a photo, events with no venue, research not linked to any
person, submissions awaiting review). Every figure is counted from real rows;
nothing is estimated or sampled.

### Email

Transactional mail via SMTP or Resend, for event-registration confirmations and
password resets. With no provider configured, every send is a logged no-op —
neither of those messages should be able to fail a transaction that already
committed.

### Password reset

Self-service reset by emailed link. Only the SHA-256 hash of each single-use,
time-limited token is stored, so a database read cannot produce a usable link.
The request endpoint returns an identical response whether or not the address
exists, so it cannot be used to enumerate accounts.

### Audit log

Every content change and sign-in, with actor, action, resource and changed
field *names*. Passwords, hashes, tokens, API keys and request bodies are never
written. There is no update or delete endpoint — a trail an ordinary admin can
rewrite proves nothing.

### SEO and accessibility

Per-route canonical URLs, Open Graph and Twitter cards, and schema.org JSON-LD
(`CollegeOrUniversity`, `Person`, `Event`, `NewsArticle`, `Course`,
`BreadcrumbList`) built only from fields that actually exist on the record.

Accessibility: skip-to-content link, named landmarks, visible `:focus-visible`
outlines, `prefers-reduced-motion` support, and a WCAG AA contrast pass
verified across all 11 public routes.

---

## 4. Architecture notes

Full detail in [`docs/architecture.md`](docs/architecture.md). The decisions
most likely to matter to a new contributor:

**Middleware is mounted once, not per handler.** `auditLog` and
`versionCapture` sit on the admin router after `authenticate`, so coverage does
not depend on remembering to add a call to each of ~100 handlers, and new routes
are covered by default.

**One `content_versions` table for all entities**, not a shadow table each.
Snapshots are read as whole documents — nothing queries across them by column —
so adding a versioned entity is a config change, not a migration.

**Provider abstractions degrade to inert, not broken.** Both the AI assistant
and email follow the same shape: `none | <provider> | <provider>`, where `none`
is fully functional and simply does less. An unconfigured optional dependency
must never be an outage.

**No in-source credential fallbacks.** The server refuses to start without
`JWT_SECRET` (min 32 chars) and the four `DB_*` values. A fallback secret in a
tracked file is both a credential leak and a way for production to boot against
the wrong database.

**The head is managed directly, not by react-helmet-async.** That package's
latest release (2.0.5) renders nothing at all under React 19 — verified in a
browser: zero injected tags, zero JSON-LD, `document.title` left at the static
value. `client/src/lib/head.js` replaces it in ~80 lines with no dependencies.

**One Sequelize footgun to know about:** `instance.get({ plain: true })` returns
`instance.dataValues` *itself*, aliased — not a copy. Snapshot code must copy
field by field. See `snapshotOf()` in `services/versioningService.js`.

---

## 5. Testing and CI

```bash
cd backend && npm test        # 79 tests across 12 suites
cd client  && npm run lint    # 0 errors
cd client  && npm run build   # 0 size warnings
```

The suite covers auth and RBAC, pagination, search, the assistant, research
authorship, event registration, the audit log, and the newer features.

Set `AUTH_RATE_LIMIT_MAX` high in CI: the suite deliberately performs failed
logins and would otherwise lock itself out of reruns.

CI (`.github/workflows/ci.yml`) runs lint, build, the test suite, and a
model-versus-schema drift check — a new column present in the database but
missing from its model silently returns `undefined`, which that check catches.

---

## 6. Deployment

Frontend on Vercel, backend on Render, managed MySQL, domain
`cse.lnmiit.ac.in`. See [`docs/deployment.md`](docs/deployment.md).

- `GET /health` — liveness. Deliberately does **not** touch the database, so a
  database blip cannot cause the platform to kill a healthy process.
- `GET /ready` — readiness, including a database check. Returns 503 with no
  error detail (the message would name the host).
- `SIGTERM`/`SIGINT` stop accepting connections, let in-flight requests finish,
  close the connection pool, then exit, with a 10-second hard timeout.

---

## 7. Known issues and gaps

Recorded honestly so they are not rediscovered later.

**Open bug — broken curriculum PDFs.** Six programmes reference
`/uploads/pdfs/*.pdf`. There is no static handler for that path (confirmed 404)
and `backend/src/uploads/` is gitignored, so every curriculum download link is
broken. Only one of the six files exists on disk. The fix is re-uploading them
through the admin panel so they land in Cloudinary. The Media Library's
**Broken references** panel lists all six.

**Hero contrast depends on the uploaded image.** The homepage heading sits over
whatever slider photo an admin uploads. The scrim was deepened to `black/45` in
the heading band, but a near-white photo would need roughly `black/80` to
guarantee WCAG AA — which would read as a solid panel rather than the intended
frosted glass. Flagged as a design decision rather than changed unilaterally.
See the comment at `client/src/pages/Home.jsx:77`.

**Two dead database tables.** `admins` (0 rows, 1 stale code reference) and
`directory` (0 rows, 2 references) are shadowed by the live `users` (12
references) and `directory_entries` (3 references). Someone will eventually
write against the wrong one.

**Uncommitted deletions in the working tree.** 21 files are staged for deletion,
including `backend/src/db/old migrations/` (18 files) and
`client/src/config.js`. Nothing in the codebase references them and all are
recoverable with `git checkout HEAD -- <path>`, but the deletions should be
reviewed before committing.

**Eight ESLint warnings** remain, all `react-hooks/exhaustive-deps` on fetch
functions in `useEffect`. They are suppressible but each needs individual
judgement about whether adding the dependency would cause a refetch loop.

---

## 8. Where things are

```
backend/src/
  config/        database, auth, cloudinary, multer
  controllers/   one per resource, plus analytics / versions / media /
                 import / submissions / schedule / passwordReset
  db/
    migrations/  33 migrations, tracked in SequelizeMeta
    models/      22 Sequelize models
  middleware/    auth, auditLog, versionCapture, errorHandler, rateLimiter
  routes/        public / admin / auth / sitemap
  services/      search, assistant, aiProvider, email, scheduler, versioning
  utils/         pagination, sql, csv, csvParse

client/src/
  components/
    admin/       TrendChart, DashboardAnalytics
    common/      SearchBox, AssistantWidget, PublicAssistant, SectionHeader
  lib/           api.js, head.js, structuredData.js
  pages/         19 public pages
    Admin/       23 admin pages
```

---

## 9. Default credentials

```
admin@lnmiit.ac.in / Admin@123
```

**Change this immediately.** It is published in this repository, which means it
is not a secret.

# Deployment

Frontend on Vercel, backend on Render, managed MySQL, domain
`cse.lnmiit.ac.in`.

> **Current status:** deployment steps below are documented and the code is
> deployment-ready, but **none of them have been executed in this round** — the
> Vercel CLI is logged out, there is no Render API key or `render.yaml`, no
> cloud database credentials were available, and the GitHub account in use has
> read-only access to the repository. See [Blockers](#blockers).

---

## Prerequisites

| | |
|---|---|
| Cloud MySQL | Provisioned and migrated — see [database-migration.md](./database-migration.md) |
| Cloudinary | Cloud name, API key, API secret |
| JWT secret | `openssl rand -hex 32` |
| Git remote | Push access to `arryanngupta/cse_department` |

---

## 1. Backend on Render

**Service settings**

| Setting | Value |
|---|---|
| Environment | Node |
| Root directory | `backend` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Node version | 20+ (set `NODE_VERSION=20` or add `engines` to `package.json`) |
| Health check path | `/health` |

`/health` is the right probe, not `/ready`: it reports process liveness without
touching the database, so a transient database problem does not cause Render to
kill and restart a process that is otherwise fine.

**Environment variables**

```
NODE_ENV=production
PORT=                       # leave unset — Render injects it
DB_HOST=…
DB_PORT=…
DB_NAME=lnmiit_cse
DB_USER=lnmiit_app
DB_PASS=…
DB_SSL=true
DB_SSL_CA=                  # optional; enables full cert verification
JWT_SECRET=…                # min 32 chars; server refuses to start without it
ORIGIN=https://cse.lnmiit.ac.in,https://<project>.vercel.app
CLOUDINARY_CLOUD_NAME=…
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…
SITE_DOMAIN=https://cse.lnmiit.ac.in
AI_PROVIDER=anthropic       # or `none`
AI_API_KEY=…
AI_RATE_LIMIT_PER_HOUR=30
```

`PORT` must stay unset — `index.js` reads `process.env.PORT`, and overriding it
makes Render's port detection fail.

**`ORIGIN` must list exact origins, comma-separated.** The previous CORS
allowlist contained the regex `/\.vercel\.app$/`, which matches *every* site
hosted on Vercel — any third party could call this API from their own
deployment with credentials attached. Wildcards are no longer accepted, and in
production a missing `ORIGIN` is a startup failure rather than a silent
fallback to localhost.

**Database allowlisting.** Copy Render's outbound IPs (Settings → Outbound IPs)
into the database firewall. Avoid `0.0.0.0/0`.

**Run migrations once** after the first deploy, from the Render shell:

```bash
npm run migrate
```

The runner is idempotent (see the migration doc), so re-running is safe.

**Verify**

```bash
curl https://<service>.onrender.com/health   # {"status":"ok",…}
curl https://<service>.onrender.com/ready    # {"status":"ready","database":"connected"}
curl https://<service>.onrender.com/api/people | head -c 200
```

Then run the suite against the deployment — it is read-only and safe to point
at production:

```bash
cd backend && BASE_URL=https://<service>.onrender.com npm test
```

> **Cold starts:** Render's free tier sleeps after inactivity, making the first
> request take ~30 s. For a public department site use a paid instance, or
> expect the delay.

---

## 2. Frontend on Vercel

| Setting | Value |
|---|---|
| Framework | Vite |
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci` |

**Environment variable**

```
VITE_API_BASE_URL=https://<service>.onrender.com
```

Two things to get right:

- **No trailing slash** — `lib/api.js` appends `/api`, so a trailing slash
  produces `//api`.
- **Never put secrets in `VITE_*`.** Those are compiled into the bundle and
  readable by anyone who loads the site. The AI key lives only in Render.

**SPA routing** is handled by `client/vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

Without it, a hard refresh on `/people/some-slug` 404s.

Deploy:

```bash
cd client
vercel login
vercel link
vercel --prod
```

**Verify:** load the site, confirm the Network tab shows requests to the Render
URL (not localhost), hard-refresh a deep link such as `/search?q=research`, and
check the browser console is clean.

---

## 3. Domain

`cse.lnmiit.ac.in` is an institutional subdomain — DNS is controlled by LNMIIT
IT, not by this project.

1. Vercel → Project → Settings → Domains → add `cse.lnmiit.ac.in`.
2. Vercel shows the required record. Normally:
   ```
   cse.lnmiit.ac.in.   CNAME   cname.vercel-dns.com.
   ```
3. Ask LNMIIT IT to create it. Do not alter institutional DNS without that
   authorisation.
4. Vercel issues the TLS certificate automatically once the record resolves
   (usually minutes; allow up to 48 h for propagation).
5. Enable the HTTPS redirect and confirm `SITE_DOMAIN` on Render matches, since
   it is used for canonical URLs and sitemap generation.
6. Add the final domain to `ORIGIN` on Render.

**Verify**

```bash
dig +short cse.lnmiit.ac.in
curl -sI http://cse.lnmiit.ac.in | grep -i location    # expect https
curl -sI https://cse.lnmiit.ac.in | head -1            # expect 200
```

---

## 4. Environment separation

| | Local | Production |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| Database | Local MySQL | Managed cloud |
| `DB_SSL` | `false` | `true` |
| `ORIGIN` | `http://localhost:3021` | Real origins only |
| `VITE_API_BASE_URL` | `http://localhost:3022` | Render URL |
| Query logging | On | Forced off |
| Error detail | `debug` field included | Generic + `errorId` |

`.env.sample` documents every variable. It contains no real values and is the
file to copy when onboarding.

Pre-deploy checklist:

- [ ] No `localhost` anywhere in production config
- [ ] `JWT_SECRET` is 32+ chars and differs from any development value
- [ ] `DB_SSL=true`
- [ ] `ORIGIN` has no wildcards
- [ ] No secret in any `VITE_*` variable
- [ ] `backend/.env` and `client/.env` untracked (`git status` clean)

---

## 5. CI

`.github/workflows/ci.yml` runs lint and build on push and pull request. It
deliberately does **not** run the API suite, which needs a live backend and
database — point it at a deployment manually, or add a MySQL service container
and a migration step if you want it in CI.

---

## Blockers

Everything below needs credentials or permissions not available in this
environment. Each line is the smallest action required to unblock it.

| Blocked | Why | To unblock |
|---|---|---|
| Cloud MySQL provisioning | No provider account or billing authorisation | Create the instance, then run `migrate-to-cloud.sh` with its URL |
| Backend deploy | No Render API key; no `render.yaml`; CLI not installed | `render login`, or create the service in the dashboard with the settings above |
| Frontend deploy | Vercel CLI reports "Logged out" | `vercel login && vercel link && vercel --prod` |
| Pushing any of this | `gh` is authenticated as `singhprathviraj41`, which has `READ` on `arryanngupta/cse_department` | Grant write access, or push from an account that has it |
| DNS for `cse.lnmiit.ac.in` | Institutional DNS, not project-controlled | Ask LNMIIT IT for the CNAME in step 3 |

The code, configuration, migration tooling, and verification scripts are all in
place; these are access gates, not engineering work.

# Admin Guide

For department staff managing the CSE website. No coding required.

Admin panel: `https://cse.lnmiit.ac.in/admin/login`
(locally: `http://localhost:3021/admin/login`)

---

## Signing in

Choose **Admin** or **Faculty** on the login form, then enter your email and
password. You land on the dashboard, which shows live counts for sliders,
faculty, programs, news, events, achievements, newsletters, directory entries
and opportunities — all read from the database, so the numbers are current.

If you were given a temporary password, you are prompted to change it before
you can continue.

**Change the default password immediately.** A fresh install ships with
`admin@lnmiit.ac.in` / `Admin@123`, which is published in this repository.

---

## Roles

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including creating and managing user accounts |
| **Admin** | All content management |
| **Faculty** | Edit their own profile only |

Permissions are enforced on the server for every request, so a faculty account
cannot reach admin data by changing a URL.

---

## Managing content

Every section follows the same pattern: a table of existing entries with
Search, Edit and Delete, plus an **Add** button.

| Section | Contents |
|---|---|
| Hero Sliders | Homepage carousel images |
| Faculty | Profiles: designation, email, research areas, photo, bio, education, publications |
| Programs | B.Tech / M.Tech / PhD, with curriculum, semesters, courses, outcomes |
| News | Articles with image, summary and body |
| Events | Title, dates, venue, description, banner |
| Achievements | Student and faculty achievements, with category tabs |
| Newsletters | PDF uploads with issue dates |
| Directory | Phone and email contact list |
| Info Blocks | Reusable text blocks used around the site |
| Research | Publications, projects, patents, collaborations |
| Facilities | Labs and facilities, with category and location |
| Opportunities | Careers and openings |

### Publishing

News, Events and Achievements have an **isPublished** flag; Facilities and
Opportunities have **is_active**.

**Unpublished content is invisible everywhere** — the public site, site search,
*and* the AI assistant. Use this to draft an announcement before it goes live.
Publishing takes effect immediately; there is no cache to clear.

### Images and PDFs

Uploads go to Cloudinary. Accepted: JPEG, PNG, WEBP, and PDF for newsletters.

Practical guidance:

- Slider images: wide landscape (roughly 1920×800) — portrait images crop badly.
- Faculty photos: square or portrait, face centred.
- Compress large photos before uploading; a 5 MB photo makes pages slow.
- Uploads are capped at 50 per hour per account.

### Deleting

Deletion removes the record from the live site immediately. If a record is
referenced elsewhere (a faculty member linked to a research project), the system
blocks the delete rather than leaving a broken reference — remove the link
first.

A deleted record's last state is kept in version history, so you can see exactly
what was removed. You cannot restore it in place, though — see
**Change history** below for why.

### Scheduling a publication date

News, Events, Achievements, Opportunities and Facilities can be scheduled rather
than published by hand.

- **Publish at** — the item stays invisible until this time, then goes live on
  its own.
- **Unpublish at** — the item comes down at this time. Must be after the publish
  time.

Schedules survive restarts and deployments. If the server is down when something
comes due, it publishes as soon as the server is back — nothing is skipped.

**Setting a future publish time takes the item off the site immediately** — it
cannot be live and waiting-to-go-live at the same time. The Scheduled page says
so when it happens, so this is never a surprise.

Two actions on each scheduled row:

- **Publish now** — clears the schedule and puts the item live straight away.
- **Clear, keep hidden** — drops the schedule but leaves the item off the site.
  Use this only if you meant to unpublish it; otherwise prefer Publish now,
  because once the schedule is gone the item no longer appears on this page.

---

## Where these tools live

The sidebar has a **Tools** group beneath the content sections: Submissions,
Scheduled, Media Library, Import CSV, Change History and Audit Log.

---

## Change history

Every change to the main content types is recorded: what changed, which fields,
who did it, and when. Open any record's history to see its versions, compare a
version against what is live now, and restore one.

Three things worth knowing:

- **A restore is itself a version.** If you restore the wrong thing, restore
  again — you will not lose anything.
- **Deleted records cannot be restored in place.** The history is there and
  readable, but putting the record back under its old ID would silently reattach
  every link that pointed at it, which is rarely what you want. Re-create it and
  copy the values across.
- **History is not the audit log.** The audit log answers "who touched this";
  history answers "what did it say before". Both exist, neither replaces the
  other.

---

## Submitting changes for review

Faculty can submit profile changes instead of saving them directly. A submission
sits in the review queue until an admin approves or rejects it.

For reviewers:

- Approving applies the change and records it in version history, so it can be
  rolled back like any other edit.
- Rejecting requires a note. The submitter sees it.
- A submission can only be reviewed once.

Submissions can never change IDs, timestamps, account links, passwords or URL
slugs, whatever they contain — those fields are stripped on the way in.

---

## Importing from a spreadsheet

People, Directory, Research and Achievements can be bulk-imported from CSV.
Download the template for the type you want: it has the exact column headers.

Always **preview first**. The preview validates every row and writes nothing —
it reports which rows are bad and why, flags duplicates both inside the file and
against records you already have, and shows what would be created.

If any row has an error, applying is refused outright. This is deliberate: a
half-imported faculty list is harder to clean up than a rejected one. Fix the
file and preview again. (There is an explicit partial-import option if you truly
want the valid rows only.)

Limit: 1000 rows per file.

Export from Excel or Sheets as **CSV UTF-8**. Commas, quotes and line breaks
inside a field are handled correctly as long as the file is properly quoted,
which both applications do.

---

## Media library

Lists every image and PDF the site references, and where each one is used.

- **Sync** rebuilds the list from current content. Safe to run any time.
- **Usage** shows exactly which records point at an asset before you touch it.
- **Deleting** an entry is blocked while anything still references it. Remove
  the references first.
- **Broken references** lists content pointing at files that are no longer
  there — this is the place to find pages with missing images.

Removing an entry from the library does **not** delete the file from Cloudinary.
The library is an index of what is in use, not storage.

---

## Dashboard

The dashboard shows live counts, content added per month over the last year,
research by type, and **content health** — a short list of things worth fixing:
faculty without a photo, faculty with no research areas, unpublished drafts,
events with no venue, research not linked to any person, and submissions waiting
on review.

Every number is counted from actual records. Nothing is estimated.

---

## Resetting a forgotten password

Use **Forgot password** on the sign-in page. A reset link is emailed, valid for
one hour and usable once. Requesting a new link invalidates the previous one.

The page shows the same confirmation whether or not the address has an account —
that is intentional, so the form cannot be used to discover which addresses are
registered.

If no email provider is configured, no mail is sent and nothing visibly fails.
An admin has to change the password directly in that case.

---

## Faculty self-service

A faculty account can sign in and edit its own profile: designation, research
areas, bio, education, publications, workshops, photo, and contact fields.

A faculty account must be linked to its public profile by an admin (the
**Faculty** section connects a user account to a People record). Until that
link exists, there is no profile to edit.

---

## Site languages

Visitors can read the site in 21 languages through the switcher in the top
bar: English plus 12 Indian languages (Hindi, Bengali, Marathi, Telugu,
Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu) and 8
international ones (French, German, Spanish, Portuguese, Russian, Arabic,
Chinese, Japanese).

Translation is machine translation by Google, applied in the browser.
Nothing you write is translated in the database, and the menu says plainly
that the English version is authoritative — worth knowing if someone reports
that a translated page reads oddly. The fix for a bad translation is to
reword the English source, not to edit the translation, which does not exist
as stored text.

The choice is remembered per browser, so a visitor who picks Tamil stays in
Tamil across pages and on their next visit.

Adding or removing a language means changing two files that must agree — see
docs/architecture.md. An automated test fails if they drift apart.

---

## Site search

A search box sits in the main navigation. Visitors can search across faculty,
programs, research, news, events, facilities, achievements, opportunities,
newsletters and the directory.

Nothing to configure: content becomes searchable as soon as it is published.
Typing shows instant suggestions; Enter opens the full results page with
category filters.

**If something is not appearing in search,** check it is published or active.

---

## AI Assistant

The floating chat button on public pages answers visitor questions about the
department.

### What it can and cannot do

It answers **only from published website content** and cites the pages it used,
so visitors can click through and verify. It cannot see drafts, user accounts,
or anything not published, and it is instructed not to invent faculty details,
publications, dates, fees, or eligibility criteria. When the website does not
cover something, it says so rather than guessing.

### Keeping its answers good

The assistant has no separate knowledge base to maintain — **it reads your
published content directly.** Improving its answers means improving the site:

- Fill in faculty research areas and bios; the assistant can only report what
  is on the page.
- Write descriptive titles — they carry the most weight in retrieval.
- Keep events and news current; stale content produces stale answers.
- Unpublish anything outdated, and it disappears from the assistant at once.

### Two operating modes

Check which you are on at `/api/assistant/status`:

| Mode | Behaviour |
|---|---|
| `generated` | Writes a short prose answer with citations |
| `retrieval-only` | Lists the matching pages without prose |

`retrieval-only` means no AI provider key is configured. The assistant still
works and still helps visitors — it just does not compose summaries. Setting
`AI_PROVIDER` and `AI_API_KEY` in the backend environment switches it to
`generated`; no code change or content migration is needed.

Visitors are limited to 30 questions per hour (configurable via
`AI_RATE_LIMIT_PER_HOUR`), which bounds cost.

### Turning it off

Set `AI_PROVIDER=none` for retrieval-only, or block
`/api/assistant/*` to remove it entirely — the widget hides itself when its
status check fails.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Cannot log in | Caps lock; or 10 failed attempts triggered a 15-minute lockout — wait it out |
| Logged out unexpectedly | Tokens last 24 hours; sign in again |
| Upload fails | Wrong file type (images and PDFs only), or the hourly upload cap |
| Image not showing | Check it saved in the admin table; verify the Cloudinary account is active |
| Content missing from the public site | Not published / not active |
| Not in search results | Same — check the publish flag |
| Assistant says it cannot find something | The information is not on a published page. Add it, publish, and ask again |
| Assistant lists pages instead of answering | `retrieval-only` mode — no AI key configured |
| Site slow on first load | Backend cold start on Render's free tier (~30 s) |

For anything not listed here, note what you were doing and any `errorId` shown,
and pass it to whoever maintains the deployment — that id maps to a specific
server log entry.

---

## Security practices

- Never share admin credentials; ask a Super Admin for your own account.
- Use a unique password of 12+ characters.
- Do not publish personal contact details without consent.
- Remove accounts for staff who have left.
- Treat the admin panel as production: changes are live immediately.

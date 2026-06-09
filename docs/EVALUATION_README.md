## 🔑 Evaluation Access (White Cloak Launchpad)

### Deployed app

**Live URL:** https://launchpad-jia-tan.vercel.app

Both portals run on this one domain (routed in `middleware.tsx`); reach each by path:
- **Applicant portal** (T5) — `/job-portal`
- **Recruiter / Employer portal** (T1–T4) — `/recruiter-dashboard`

### Signing in

Authentication is **Google SSO** — click **Continue with Google** (there is no email + password form; the Microsoft button on the deployment is not active). Two ways to review:

**A. Applicant side (T5) — no shared credentials needed.**
Open the **Applicant** URL and sign in with **any Google account** (click **Continue with Google** on `/login`). A first-time account with no organization is treated as an applicant and lands on the candidate dashboard. From there: **Submit CV → "Create a Profile Manually"** to review the T5 wizard end-to-end.

**B. Recruiter side (T1–T4) — sign in with your White Cloak email.**
The evaluator emails from the access request have been added as **admins** of the seeded org (**Launch Round Test Org**). Sign in with **Continue with Google** using your `@whitecloak.com` account and you'll land on the recruiter dashboard. First login activates the invite automatically — there is no separate accept step.

**Shared test recruiter account (fallback)** — if your email isn't a Google account:

| Field | Value |
|---|---|
| Email | `jia.recruiter.wc@gmail.com` |
| Password | `jiarecruiter123` |
| Organization | Launch Round Test Org |

**Applicant test account** (or use any Google account): `jia.applicant@gmail.com` / `jiaapplicant123`

> **Note:** The same email can use both portals — a recruiter account can also open the **Applicant** URL to review T5 (its candidate profile starts empty until you run the Submit CV flow).



### Reviewing each ticket

| Ticket | Where to look | What to verify |
|---|---|---|
| **T1 — Setup** | App loads on both portal URLs | App builds/deploys and serves; SSO login works |
| **T2 — CV Fitness V2** | Recruiter → a Career → a candidate's **Evaluation by Jia** card → **View Analysis** | Structured job description (Overview / Roles / Required / Preferred); each qualification bucketed **Matched / Partially Matched / Missing**; match-score donut |
| **T3 — Pipeline Report** | Recruiter → **Dashboard → Pipeline Report** tab (also Project → Project Detail → Pipeline Report) | Per-stage counts across careers; filters; per-stage/sub-stage + dropped toggles; column drag/pin; **CSV/XLSX export**; fullscreen; parent-child rows |
| **T4 — Archive Career** | Recruiter → **Careers** → a career's kebab menu → **Archive** (then **Archived** filter → **Restore**) | Archive replaces Delete; cascades to child posts; hidden by default + excluded from metrics; restore stays unpublished |
| **T5 — Candidate Profile** | Applicant → **Submit CV → Create a Profile Manually** | 10-step wizard; phone format + uniqueness (no Firebase phone verification); **✨ Generate Introduction** (AI); draft auto-save / resume |

### Feature & QA documentation

- `CV_FITNESS_V2.md`, `PIPELINE_REPORT.md`, `ARCHIVE_CAREER.md`, `CANDIDATE_PROFILE.md` — per-ticket design + maintainer docs.
- `CHANGES.md` — full change audit (created/modified/deleted files per ticket) + feature explanations.
- `TEST_REPORT.md` — QA pass results (171 unit tests, type-check, clean production build, per-ticket acceptance criteria).
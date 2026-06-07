# Jia Web App

Jia is a next-generation hiring platform powered by AI, designed to streamline recruitment processes, from CV screening to automated candidate communication.

---

## 🔑 Evaluation Access (White Cloak Launchpad)

> **For evaluators.** Everything needed to access and review the deployed app. All links below are public; if any link fails to load, please contact the submitter.

### Deployed app

**Live URL:** https://launchpad-jia-tan.vercel.app

Both portals run on this one domain (routed in `middleware.tsx`); reach each by path:
- **Applicant portal** (T5) — `/job-portal`
- **Recruiter / Employer portal** (T1–T4) — `/recruiter-dashboard`

### Signing in

Authentication is **Google / Microsoft SSO only** (there is no email + password form). Two ways to review:

**A. Applicant side (T5) — no shared credentials needed.**
Open the **Applicant** URL and sign in with **any Google account**. A first-time account with no organization is treated as an applicant and lands on the candidate dashboard. From there: **Submit CV → "Create a Profile Manually"** to review the T5 wizard end-to-end.

**B. Recruiter side (T1–T4) — use the provided test recruiter account.**
The recruiter dashboard requires membership in a seeded organization, so please sign in with the dedicated test account below (a real Google account; use the Google SSO button):

| Field | Value |
|---|---|
| Email | `jia.recruiter.wc@gmail.com` |
| Password | `jiarecruiter123` |
| Organization | Launch Round Test Org |

**Applicant test account** (or use any Google account): `jia.applicant@gmail.com` / `jiaapplicant123`



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

---

## 🚀 Getting Started

### 1. Git Branching Model
The project follows a standard branching workflow:
- **`staging`**: The default development branch. All feature branches should be merged here for testing.
- **`main`**: Production branch. This branch contains the stable, live code.

### 2. Prerequisites
- **Node.js**: v18.x or higher
- **pnpm**: Required package manager
- **MongoDB**: Access to a MongoDB instance
- **Firebase**: Project configured for Auth and Storage

### 3. Installation

First, clone the repository and install dependencies:

```bash
git clone https://github.com/your-repo/jia-web-app.git
cd jia-web-app
pnpm install
```

### 4. Environment Configuration
Create a `.env` file in the root directory and populate it with the following required variables:

```env
# Core Database & AI
MONGODB_URI=your_mongodb_uri
MONGODB_DBNAME=your_db_name
OPENAI_API_KEY=your_openai_api_key

# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side)
FIREBASE_SERVICE_ACCOUNT=your_service_account_json_string

# Application Domains
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APPLICANT_APP_DOMAIN=localhost:3000
NEXT_PUBLIC_EMPLOYER_APP_DOMAIN=localhost:3000
NEXT_PUBLIC_ADMIN_APP_DOMAIN=localhost:3000

# External Integrations (JVX Backend)
NEXT_PUBLIC_CORE_API_URL=https://jia-jvx-1a0eba0de6dd.herokuapp.com

# Email & Storage (Mailgun & Cloudflare R2)
MAILGUN_API_KEY=your_mailgun_key
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

# Web Push Notifications (VAPID Keys)
NEXT_PUBLIC_VAPID_CLIENT=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

### 5. Running the Project

Start the development server with hot reloading:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
pnpm start
```

### 6. Generating VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for Web Push notifications. Generate a new key pair using the `web-push` CLI:

```bash
pnpm dlx web-push generate-vapid-keys
```

> **Important**: VAPID keys must match between environments. If you regenerate keys, all existing push subscriptions become invalid and users must re-subscribe.

---

## 📂 Project Structure

```text
jia-web-app/
├── public/              # Static assets (images, icons, SVG)
├── src/
│   ├── app/             # App Router: Pages, Layouts, and API Routes
│   │   ├── api/         # Backend serverless functions
│   │   ├── dashboard/   # Recruiter/Employer dashboard
│   │   └── applicant/   # Applicant-facing pages
│   ├── lib/             # Shared logic and UI
│   │   ├── components/  # Reusable React components
│   │   ├── context/     # React Context providers (App, Upload, etc.)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── firebase/    # Firebase client/admin initialization
│   │   ├── mongoDB/     # MongoDB connection logic
│   │   └── utils/       # Helper functions and API clients
├── lib/
│   └── swr/
│       └── config.ts    # SWR global configuration
└── package.json         # Project configuration and scripts
```

## 🔌 External Integrations

- **JVX Backend Service**: `https://jia-jvx-1a0eba0de6dd.herokuapp.com`
  - Handles specialized tasks like CV parsing (`/upload-cv`), LinkedIn scraping, and interview recording formatting.
- **Mailgun**: Used for automated candidate reminders and transactional emails.
- **Cloudflare R2**: Object storage for CV files and attachments.
- **OpenAI**: Powers the AI Screening, CV digitalization, and LLM-based reasoning features.

## 🛠 Tech Stack
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **UI**: React 19, Bootstrap 4 (argon-design), SASS
- **Database**: MongoDB
- **Auth**: Firebase Authentication
- **State Management**: React Context API
- **Data Fetching**: [SWR](https://swr.vercel.app/) (stale-while-revalidate)
- **Tables**: TanStack Table (React Table v8)
- **Push Notifications**: Web Push API with VAPID

# Jia Web App

Jia is a next-generation hiring platform powered by AI, designed to streamline recruitment processes, from CV screening to automated candidate communication.

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

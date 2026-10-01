# PostPilot AI

PostPilot AI is a TypeScript SaaS MVP for generating, editing, saving, and planning social-media content. It uses React + Vite + Tailwind in the browser, an Express API, Prisma, and MySQL.

## What works

- Cookie-based JWT authentication, account profile/password changes, and password reset tokens (SMTP email in production; a development-only reset token is returned locally).
- Server-side AI content, idea, hashtag, rewrite, shorten, and expand requests through an OpenAI-compatible chat-completions API.
- Optional Tavily advanced web research with source excerpts and citations shown separately from generated social copy.
- Short/Medium/Long content drafts with enforced minimums of 51/71/101 words and live platform/content checks.
- AI usage reservation and plan-limit enforcement in the API.
- Database-backed content drafts, variations, saved posts, favorites, search, filters, pagination, and calendar scheduling/status.
- Brand profiles, database-seeded templates, basic analytics, and subscription/usage views.
- Responsive landing page and authenticated workspace.

Paid checkout, team/client workspaces, and direct social publishing are not enabled in this MVP. The API reports billing as disabled; the Free plan works without payment. Business/agency analytics are currently the same basic application analytics available to the other plans.

## Requirements

- Node.js 20 LTS or newer (includes `npm`)
- MySQL 8.x; XAMPP's MySQL service is suitable for local development
- An OpenAI-compatible AI API key for actual AI generation
- SMTP credentials for production password-reset email

## Run locally on Windows

Run these commands from the repository root in PowerShell. Use `npm.cmd` if the PowerShell execution policy blocks `npm.ps1`.

1. Install Node.js 20 LTS or newer from [nodejs.org](https://nodejs.org/) and verify:

   ```powershell
   node --version
   npm.cmd --version
   ```

2. Install XAMPP, open its Control Panel, and start **MySQL**.
3. Create an empty database with MySQL Workbench or XAMPP's MySQL command-line client:

   ```sql
   CREATE DATABASE postpilot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

4. Copy the environment template and edit `.env` in the project root:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `DATABASE_URL` to your MySQL username/password and database. For a common local XAMPP setup:

   ```dotenv
   DATABASE_URL="mysql://root:@localhost:3306/postpilot"
   JWT_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
   AI_API_KEY="your-server-side-provider-key"
   AI_CREDENTIALS_SECRET="64-character-hex-secret-for-encrypting-account-provider-keys"
   FRONTEND_URL="http://localhost:5173"
   COOKIE_SECURE=false
   ```

   Keep `.env` private and never put `AI_API_KEY`, `AI_CREDENTIALS_SECRET`, `JWT_SECRET`, or database credentials in frontend source code. Generate `AI_CREDENTIALS_SECRET` once with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and keep it stable so saved account keys remain decryptable. The local draft fallback works without a provider key.

5. Install dependencies, generate the Prisma client, create the schema, and seed demo data:

   ```powershell
   npm.cmd install
   npm.cmd run db:generate
   npm.cmd run db:migrate --workspace backend -- --name init
   npm.cmd run db:seed
   ```

   Seeding creates the demo account `demo@postpilot.local` with password `DemoPass123!`, a sample brand, a saved/favorited example post, a calendar entry, and ten templates. The demo user is assigned the Business plan locally to exercise plan-gated features; newly registered accounts start on Free. These credentials are for local development only. Production seeding is blocked unless explicitly enabled with `ALLOW_DEMO_SEED=true`; change `DEMO_EMAIL` and `DEMO_PASSWORD` if desired.

6. Start both development servers:

   ```powershell
   npm.cmd run dev
   ```

7. Open [http://localhost:5173](http://localhost:5173). The API health endpoint is [http://localhost:4000/api/health](http://localhost:4000/api/health).

The backend defaults to port `4000`. Content generation remains usable before you configure an AI provider: the API generates a tailored local draft from the supplied details and persists it normally. AI-generated copy, ideas, hashtags, and rewriting require a connected provider. If deploying the frontend and API on different hosts, set the frontend build variable `VITE_API_URL` to the public API base URL (including `/api`) and set the API's `FRONTEND_URL` to the exact frontend origin.

## Password reset email

In non-production mode (`NODE_ENV` unset or `development`), `POST /api/auth/forgot-password` returns a reset token for local testing. The frontend lets you paste that token into the reset form. In production, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and `FRONTEND_URL`; the API emails a single-use link that expires after 30 minutes. It returns an explicit configuration error rather than claiming that an email was sent when SMTP is missing.

## AI provider

The backend calls an OpenAI-compatible chat-completions endpoint. Users can connect OpenAI or a configurable OpenAI-compatible provider from **Settings → AI provider connection**. Account keys are encrypted at rest with AES-256-GCM using the server-only `AI_CREDENTIALS_SECRET`; it must be a 64-character hex string and remain stable. The key is never included in API responses. An account connection takes precedence over the optional server-wide `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` fallback. The defaults target OpenAI and `gpt-4o-mini`. Set compatible-provider URLs to the API base (for example, `https://api.provider.example/v1`); the backend appends `/chat/completions`.

After configuring the encryption secret, restart the backend. Sign in and open **Settings → AI provider connection** to save and test an account-specific provider. `GET /api/ai/status` reports provider/model readiness without returning the key; `POST /api/ai/test` reports authentication, model, endpoint, quota, and connectivity errors. The test request does not consume the user's generation quota, but it does make a small provider request. Account keys are sent only to the backend and encrypted before storage.

For source-grounded drafting, add a Tavily Search API key in **Settings → Deep research connection**. The **Deep research · Tavily Advanced** option runs an advanced web search before generation and presents citations separately from the social post. Advanced search can consume 2 Tavily API credits per run. The search query uses the topic description, brand industry, and campaign goal; it deliberately excludes audience, contact information, prices, and other private brand fields. Deep research also requires a connected AI provider so the retrieved source material can be used in the copy. Review the cited pages before publishing.

Generated post lengths have minimums: **Short: 51 words**, **Medium: 71 words**, and **Long: 101 words**. AI responses below the selected minimum are retried twice and then fail with an actionable error rather than returning an under-length post. The requested minimum takes priority over a social platform's usual character guide; the generator flags posts that exceed that guide.

Common configuration errors:

- **Cannot save account key:** set a valid 64-character hex `AI_CREDENTIALS_SECRET` in the project-root `.env`, then restart the API.
- **No provider configured:** connect one in Settings or add a server-side `AI_API_KEY` to the project-root `.env` as a shared fallback.
- **401/403:** the provider rejected the key; verify it with the provider. Never paste the key into chat or frontend code.
- **404:** check the model name and set `AI_BASE_URL` to the provider's OpenAI-compatible API base URL.
- **429:** check the provider's account quota and rate limits.
- **Timeout/network:** verify the URL and that the backend machine can reach the provider.

## Useful commands

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd test
npm.cmd run db:generate
npm.cmd run db:migrate --workspace backend -- --name describe_change
npm.cmd run db:seed
```

## Deployment

- **Frontend:** build `frontend` with `npm run build --workspace frontend`; deploy the generated `frontend/dist` directory to Vercel or another static host. Set `VITE_API_URL` at build time.
- **Backend:** deploy the Node.js workspace (`npm run build --workspace backend`, then `npm run start --workspace backend`) to Render, Railway, or a VPS.
- **Database:** use managed MySQL and set `DATABASE_URL`. Apply committed migrations during deployment with `prisma migrate deploy`.
- Set a long random `JWT_SECRET`, `NODE_ENV=production`, `COOKIE_SECURE=true`, the exact `FRONTEND_URL`, AI provider credentials, and SMTP credentials. Configure TLS and restrict database access to the API service.
- The browser session cookie is HTTP-only and SameSite Strict. CORS only allows the configured frontend origin.

## Project layout

```text
frontend/                 React + TypeScript + Vite + Tailwind application
  src/components/         Shared UI components
  src/context/            Authentication state
  src/hooks/              Shared data hooks
  src/layouts/            Authenticated application shell
  src/pages/              Landing, auth, and workspace pages
  src/services/           API client
  src/types/              Frontend types
  src/utils/              Shared utilities
backend/                  Express + TypeScript API
  src/controllers/        Health endpoint controller
  prisma/schema.prisma    MySQL data model
  prisma/seed.ts          Idempotent demo and template seed
  src/middleware/         Session authentication
  src/routes/             REST endpoints
  src/services/           AI integration and usage/plan limits
  src/validators/         Shared Zod input schemas
database/                 Database setup notes
docs/                     API and architecture documentation
```

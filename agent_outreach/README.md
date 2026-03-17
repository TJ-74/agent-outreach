# Agent Outreach

A Next.js app for managing leads, email sequences, and outreach with manual approval before sending. Connect **Microsoft Outlook** or **Google Gmail**, build sequences, assign groups, then review and approve each email before it's sent.

---

## Features

- **Leads** — Add leads manually or bulk-import via CSV with column mapping. View and edit lead details, status, and threads.
- **Groups** — Organize leads into groups. Import CSV directly into a group.
- **Sequences** — Multi-step email sequences with delay days and templates (variables: `{{firstName}}`, `{{lastName}}`, `{{email}}`, `{{company}}`, `{{jobTitle}}`).
- **Approval flow** — Before any sequence email is sent, you get a per-lead preview with **Approve** / **Decline**. Edit subject and body inline, then send or skip. Sent emails are stored and viewable in a **Sent** list.
- **Email** — Send via **Outlook** (Microsoft Graph) or **Gmail** (OAuth). One-click connect in Settings; the app uses whichever account is connected.
- **Dashboard** — Overview of leads and action-needed counts.

---

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS 4**
- **Supabase** — PostgreSQL (leads, groups, sequences, enrollments, sent emails, OAuth tokens)
- **Zustand** — Client state
- **Microsoft Graph API** (Outlook), **Gmail API** (Google)

---

## Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm
- **Supabase** project
- **Microsoft** and/or **Google** OAuth apps (for Outlook and Gmail)

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd agent_outreach
pnpm install
```

### 2. Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase and OAuth settings (see [Environment variables](#environment-variables) below). **Do not commit `.env.local`** — it is gitignored.

### 3. Database

Run the Supabase migration in your project's **SQL Editor**:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Paste and run the contents of `supabase_migration.sql`.

This creates/updates tables for users, leads, messages, sequences, sequence_steps, sequence_enrollments, groups, group_members, drafts, sent_emails, and OAuth token storage.

### 4. OAuth (Outlook and/or Gmail)

- **Outlook:** Create an app in [Azure Portal](https://portal.azure.com) (Microsoft Entra ID). Add redirect URI `http://localhost:3000/api/auth/outlook/callback` (or your production URL). Use the same redirect in `OUTLOOK_REDIRECT_URI`.
- **Gmail:** Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com). Add redirect URI `http://localhost:3000/api/auth/google/callback`. Enable the **Gmail API** for the project. Add test users if the app is in testing.

### 5. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in via Outlook or Google in **Settings**, then use **Leads**, **Groups**, **Sequences**, and **Approval**.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `OUTLOOK_CLIENT_ID` | Microsoft Entra (Azure AD) app client ID |
| `OUTLOOK_CLIENT_SECRET` | Microsoft app client secret |
| `OUTLOOK_REDIRECT_URI` | e.g. `http://localhost:3000/api/auth/outlook/callback` |
| `OUTLOOK_SCOPES` | e.g. `openid profile email User.Read Mail.Send Mail.Read offline_access` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | e.g. `http://localhost:3000/api/auth/google/callback` |
| `GOOGLE_SCOPES` | e.g. `openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send` |
| `NEXT_PUBLIC_APP_URL` | (Optional) Full app URL for webhooks, e.g. `https://yourdomain.com` |
| `NEXT_PUBLIC_AGENT_URL` | (Optional) Backend agent URL, e.g. `http://localhost:8000` |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (default port 3000) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |

---

## Project structure

```
src/
├── app/
│   ├── api/           # API routes (auth, sequences, email, sent-emails, …)
│   ├── approval/      # Approval queue page (Pending / Sent tabs)
│   ├── leads/         # Leads list
│   ├── groups/        # Groups list
│   ├── sequences/     # Sequences list + [sequenceId]/approve
│   ├── settings/      # Email connection (Outlook / Google)
│   └── page.tsx       # Dashboard
├── components/        # React components (modals, panels, sidebar)
├── lib/               # Supabase, Outlook, Google, sequence helpers
├── store/             # Zustand stores (leads, groups, sequences, …)
└── app/globals.css    # Tailwind + theme
supabase_migration.sql # DB schema (run in Supabase SQL Editor)
```

---

## License

Private / unlicensed unless otherwise specified.

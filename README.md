# BallotOS

An election management system — React (Vite) frontend on Supabase (Postgres,
Auth, Storage, Realtime), deployable to Vercel. Fully independent of Base44.

## What changed from the Base44 export

- **`src/api/base44Client.js`** — no longer a `@base44/sdk` client. It's now a
  small shim backed by Supabase that keeps the *same shape*
  (`base44.entities.Candidate.filter(...)`, `base44.auth.me()`,
  `base44.integrations.Core.UploadFile(...)`) so almost none of the
  pages/components had to change.
- **Auth** (`src/lib/AuthContext.jsx`, `Login.jsx`, `Register.jsx`,
  `ForgotPassword.jsx`, `ResetPassword.jsx`) — rewritten for Supabase Auth,
  email/password only (no Google sign-in).
- **`supabase/schema.sql`** — the full Postgres schema (mirrors the original
  Election/Position/Candidate/Student/VotingStation/Vote/User/AuditLog
  entities) plus Row Level Security policies.
- **`api/invite-user.js`** — a Vercel serverless function used by the Users
  page to invite new admins/observers/polling assistants. It's the one place
  that needs the Supabase **service role** key (never exposed to the browser).
- Removed everything Base44-platform-specific: the OAuth-consent MCP page,
  the app-bootstrap token plumbing, Google sign-in.

Everything else (all pages, all UI components, the voting flow, results
tallying, imports, etc.) is unchanged.

---

## 1. Set up Supabase

You said you already have a project — good, you just need three things from
**Project Settings → API**:

- Project URL
- `anon` public key
- `service_role` key (keep this one secret)

Then run the schema:

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.
   This creates all tables, the `handle_new_auth_user` trigger (so every
   signup gets a `public.users` profile row), RLS policies, the realtime
   publication for `votes`, and a public storage bucket called
   `ballotos-media` for candidate photos / election logos.
3. **Auth settings** — go to **Authentication → URL Configuration** and set:
   - Site URL: your deployed URL (e.g. `https://ballotos.vercel.app`), or
     `http://localhost:5173` while developing locally.
   - Redirect URLs: add both the local and deployed URLs.
   - If you want to skip email confirmation while testing, go to
     **Authentication → Providers → Email** and toggle off "Confirm email".

The very first person who signs up via `/register` becomes an `admin`
automatically (see the `handle_new_auth_user` trigger — the entity default in
the original app was also `admin`). Everyone after that should be invited
from the **Users** page so their role can be set to `observer` or
`polling_assistant` on the way in.

---

## 2. Run it locally (VS Code, Command Prompt)

Open the project folder in VS Code, then open a terminal (**Terminal → New
Terminal**, make sure it's using **Command Prompt**, not PowerShell/Git Bash —
you said cmd is your preference).

```cmd
cd path\to\BallotOS
npm install
copy .env.example .env
```

Now open `.env` in VS Code and fill in your real values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` isn't used by `npm run dev` (that's a Vercel
serverless-function-only var — see step 4), so it's fine to leave it blank
locally unless you're testing the invite-user function with `vercel dev`.

Then:

```cmd
npm run dev
```

Open the printed `http://localhost:5173` URL, go to `/register`, create your
first (admin) account, and you're in.

---

## 3. Push to GitHub

```cmd
git init
git add .
git commit -m "BallotOS: independent React + Supabase rewrite"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ballotos.git
git push -u origin main
```

(`.env` is already in `.gitignore` — your keys won't be committed.)

---

## 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import
   the GitHub repo you just pushed.
2. Vercel will auto-detect Vite. Leave the build command
   (`npm run build`) and output directory (`dist`) as-is — `vercel.json`
   already has this configured.
3. Before the first deploy, add **Environment Variables**
   (Project → Settings → Environment Variables):

   | Name | Value | Notes |
   |---|---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL | exposed to browser |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key | exposed to browser (safe — protected by RLS) |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key | **server-only**, used by `api/invite-user.js` |

4. Deploy. Once it's live, go back to Supabase **Authentication → URL
   Configuration** and add the deployed URL to Site URL / Redirect URLs.

Every `git push` to `main` after this auto-deploys.

---

## Project structure

```
BallotOS/
├── api/
│   └── invite-user.js       # Vercel serverless fn (service role, user invites)
├── supabase/
│   └── schema.sql           # run once in the Supabase SQL editor
├── src/
│   ├── api/base44Client.js  # Supabase-backed shim (kept the base44 SDK shape)
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   ├── AuthContext.jsx
│   │   └── ems.js           # roles, station helpers, CSV parsing, theming
│   ├── components/          # ui/ (shadcn-style), ems/, layout/, voting/
│   └── pages/                # Dashboard, Elections, Candidates, Voting, ...
├── .env.example
├── vercel.json
└── vite.config.js
```

## Roles

| `ems_role` | Capabilities |
|---|---|
| `admin` | Full access: elections, positions, candidates, students, stations, results, reports, archives, users, branding, settings, audit logs |
| `observer` | Audit logs only — scoped to their `assigned_election_id` if one is set (enforced in `supabase/schema.sql` RLS, not just the UI) |
| `polling_assistant` | Station setup + the voting screen only |

To scope an observer to a single election, set their `assigned_election_id`
in the `users` table (Supabase Table Editor, or a future admin UI field).

## Known follow-ups

- The chunk-size build warning (`index-*.js` ~2 MB) is cosmetic — the app
  works fine, but you can shrink initial load later with route-based
  `React.lazy()` code-splitting.
- `src/components/ui/image.jsx` still contains Wix/Base44 CDN transform logic
  (image resizing via URL params). It degrades gracefully to a plain `<img>`
  for Supabase Storage URLs, so nothing is broken — just dead code you can
  remove later if you want to trim the bundle.

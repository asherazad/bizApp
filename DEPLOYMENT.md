# BizPortal — Deployment Guide

## Architecture

```
GitHub repo (monorepo)
├── Frontend (React/Vite)  →  Vercel (static hosting + CDN)
├── Backend (Express)      →  Vercel (serverless functions at /api/*)
└── Database (PostgreSQL)  →  Supabase (managed Postgres)
```

All three are free tiers:
- **Vercel** — free for hobby projects, auto-deploys on every git push
- **Supabase** — free tier: 500MB storage, 2 projects
- **GitHub** — free for public and private repos

---

## Step 1 — Push to GitHub

### 1a. Create the repo on GitHub
1. Go to https://github.com/new
2. Name it `bizportal` (or any name)
3. Set to **Private**
4. Do **NOT** initialize with README (you already have one)
5. Click **Create repository**

### 1b. Push from your machine

```bash
cd bizportal

# Initialize git (if not done yet)
git init
git add .
git commit -m "feat: initial commit — BizPortal foundation + invoicing module"

# Link to your GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/bizportal.git
git branch -M main
git push -u origin main
```

### Branch strategy
```bash
main          # production — deploys to Vercel automatically
develop       # staging branch — create PR to main
feature/*     # feature branches — create PR to develop
```

Create the develop branch:
```bash
git checkout -b develop
git push -u origin develop
```

---

## Step 2 — Set up Supabase

### 2a. Create a project
1. Go to https://supabase.com → **New project**
2. Name: `bizportal`
3. Set a strong database password — **save this, you'll need it**
4. Region: choose closest to your users
5. Click **Create new project** (takes ~2 minutes)

### 2b. Get your database connection string
1. Go to **Settings** → **Database**
2. Scroll to **Connection string** → select **URI**
3. Copy the string — it looks like:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the password you set

> **Use the Supabase pooler URL** (port 6543) for serverless/Vercel.
> The direct connection (port 5432) is for local dev and migrations only.

### 2c. Run migrations against Supabase

Add the Supabase connection string to your local `.env`:
```bash
# .env (local file — never commit this)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

> Use port **5432** (direct) for migrations, **6543** (pooler) for Vercel.

Run migrations:
```bash
cd server && npm install
npm run db:migrate
npm run db:seed
```

You should see tables appear in Supabase → **Table Editor**.

### 2d. Disable Row Level Security (for simplicity)
Supabase enables RLS by default. Since we handle auth ourselves (JWT), disable it:

In Supabase → **SQL Editor**, run:
```sql
ALTER TABLE tenants        DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments    DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles          DISABLE ROW LEVEL SECURITY;
ALTER TABLE users          DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles     DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients        DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments       DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences DISABLE ROW LEVEL SECURITY;
```

---

## Step 3 — Deploy to Vercel

### 3a. Connect repo to Vercel
1. Go to https://vercel.com → **Add New Project**
2. Click **Import Git Repository** → select your `bizportal` repo
3. Vercel auto-detects Vite — leave framework as **Vite**
4. **Root Directory**: leave as `/` (root)
5. **Build Command**: `npm run build` (from `vercel.json`)
6. **Output Directory**: `dist` (from `vercel.json`)

### 3b. Add environment variables
In Vercel project → **Settings** → **Environment Variables**, add:

| Key | Value | Environment |
|-----|-------|-------------|
| `DATABASE_URL` | Your Supabase pooler URL (port 6543) | Production, Preview |
| `JWT_SECRET` | A long random string (32+ chars) | Production, Preview |
| `CLIENT_URL` | `https://your-app.vercel.app` | Production |
| `NODE_ENV` | `production` | Production |

> Generate a JWT secret: `openssl rand -base64 32`

### 3c. Deploy
Click **Deploy**. Vercel will:
1. Install dependencies
2. Build the React app (`vite build`)
3. Deploy the `/api/index.js` as a serverless function
4. Serve `dist/` as static files on CDN

Your app will be live at `https://bizportal-[hash].vercel.app`

### 3d. Set a custom domain (optional)
Vercel → **Settings** → **Domains** → add your domain.

---

## Step 4 — Verify deployment

Test the API:
```bash
curl https://your-app.vercel.app/api/health
# Expected: {"ok":true,"env":"production","db":"configured"}
```

Test login:
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"password"}'
```

---

## Local development after deployment

```bash
cp .env.example .env
# Fill in DATABASE_URL (use Supabase direct URL port 5432 for local)
# Fill in JWT_SECRET (same value as Vercel)

npm install
cd server && npm install && cd ..
npm run dev:full
```

---

## Continuous deployment workflow

```
You push to main
       ↓
GitHub webhook triggers Vercel
       ↓
Vercel builds & deploys (< 60 seconds)
       ↓
Live at your domain
```

For database schema changes:
```bash
# Create new migration
cd server && npx knex migrate:make add_new_feature

# Test locally
npm run db:migrate

# Push to GitHub → auto-deploy to Vercel
# Then run migration against Supabase manually:
npm run db:migrate:prod
```

---

## Environment variables summary

### Local `.env` (never commit)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bizportal
JWT_SECRET=local-dev-secret-any-string
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

### Vercel dashboard
```env
DATABASE_URL=postgresql://postgres.[ref]:[pass]@pooler.supabase.com:6543/postgres
JWT_SECRET=<32+ char random string>
CLIENT_URL=https://your-app.vercel.app
NODE_ENV=production
```

---

## Troubleshooting

**"Cannot find module" on Vercel**
→ Make sure `server/package.json` has all deps listed. Vercel runs `npm install` from root but the `api/index.js` requires server modules.

**Database connection timeout**
→ Use the Supabase **pooler** URL (port 6543) for Vercel, not the direct URL.

**CORS errors**
→ Add your Vercel URL to `CLIENT_URL` env var in Vercel dashboard.

**Migrations not running**
→ Run `npm run db:migrate:prod` manually from your local machine pointing at Supabase URL.

**RLS blocking queries**
→ Run the `DISABLE ROW LEVEL SECURITY` SQL in Supabase SQL Editor.

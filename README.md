# BizPortal

Multi-tenant business management portal — invoicing, clients, expenses, HR, and P&L reporting.

**Stack:** React + Vite · Express · PostgreSQL (Supabase) · Deployed on Vercel

---

## Quick start (local)

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/bizportal.git
cd bizportal

# 2. Install
npm install && cd server && npm install && cd ..

# 3. Configure
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET

# 4. Database
npm run db:setup     # migrate + seed demo data

# 5. Start
npm run dev:full     # frontend :3000 + backend :4000
```

Login: `admin@acme.com` / `password`

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full Vercel + Supabase setup.

| Service | Purpose | Free tier |
|---------|---------|-----------|
| **Vercel** | Frontend + API (serverless) | ✓ |
| **Supabase** | PostgreSQL database | ✓ 500MB |
| **GitHub** | Source control + CI | ✓ |

---

## Project structure

```
bizportal/
├── api/
│   └── index.js          # Vercel serverless entry point
├── server/
│   ├── db/
│   │   ├── migrations/   # Knex migrations
│   │   └── seeds/        # Demo data
│   ├── middleware/        # Auth, tenant, RBAC
│   ├── routes/            # Express route handlers
│   └── services/          # Business logic (calculations)
├── src/
│   ├── components/        # Shared UI components
│   ├── context/           # React contexts (Auth, Tenant, Dept)
│   ├── lib/               # API client, hooks, utilities
│   └── pages/             # Feature pages
├── .github/workflows/     # CI + auto-migrations
├── vercel.json            # Vercel config
└── DEPLOYMENT.md          # Full deploy guide
```

---

## Modules

| Module | Status |
|--------|--------|
| Authentication + RBAC | ✅ Done |
| Multi-tenant core | ✅ Done |
| Dashboard | ✅ Done |
| Invoices (PDF upload + AI extraction) | ✅ Done |
| Clients (CRUD + stats) | ✅ Done |
| Quotations | ✅ Done |
| Expenses | 🔜 Sprint 4 |
| Resources (HR) | 🔜 Sprint 4 |
| Inventory | 🔜 Sprint 5 |
| Reports & P&L | 🔜 Sprint 5 |

---

## Contributing

```bash
git checkout -b feature/your-feature
# make changes
git push origin feature/your-feature
# open PR to develop
```
# bizApp

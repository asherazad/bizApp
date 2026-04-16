# BizPortal — Full Stack Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+ (running locally or via Docker)

---

## 1. Database Setup

### Option A — Local PostgreSQL
```bash
psql -U postgres -c "CREATE DATABASE bizportal;"
```

### Option B — Docker (easiest)
```bash
docker run -d \
  --name bizportal-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bizportal \
  -p 5432:5432 \
  postgres:16
```

---

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bizportal
JWT_SECRET=your-long-random-secret-here
```

---

## 3. Install dependencies

```bash
# Frontend deps
npm install

# Backend deps
cd server && npm install && cd ..
```

---

## 4. Run database migrations + seed

```bash
npm run db:setup
```

This creates all tables and inserts demo data:
- Tenant: Acme Technologies
- Departments: Engineering, Sales, Operations
- Demo user: **admin@acme.com / password**
- 4 sample clients

---

## 5. Start the app

### Development (both servers together)
```bash
npm run dev:full
```
- Frontend → http://localhost:3000
- Backend API → http://localhost:4000

### Or start separately
```bash
# Terminal 1 — backend
npm run server:dev

# Terminal 2 — frontend
npm run dev
```

---

## API Endpoints

| Method | Endpoint                        | Description               |
|--------|---------------------------------|---------------------------|
| POST   | /api/auth/login                 | Login, get JWT            |
| GET    | /api/auth/me                    | Current user              |
| GET    | /api/clients                    | List clients              |
| POST   | /api/clients                    | Create client             |
| PUT    | /api/clients/:id                | Update client             |
| DELETE | /api/clients/:id                | Archive client            |
| GET    | /api/invoices                   | List invoices (paginated) |
| GET    | /api/invoices/summary           | Summary stats             |
| GET    | /api/invoices/:id               | Invoice detail + items    |
| POST   | /api/invoices                   | Create invoice (from PDF) |
| PUT    | /api/invoices/:id               | Update invoice            |
| DELETE | /api/invoices/:id               | Cancel invoice            |
| POST   | /api/invoices/:id/send          | Mark as sent              |
| POST   | /api/invoices/:id/payments      | Record payment            |
| GET    | /api/departments                | List departments          |

---

## PDF Upload Flow

1. User uploads invoice PDF on `/invoices/upload`
2. PDF.js extracts text in the browser (free, no API key)
3. User reviews extracted fields, assigns dept per line item
4. If client not found → "+ New client" opens inline modal (pre-filled from PDF)
5. On confirm → POST /api/invoices saves to PostgreSQL
6. Invoice appears in list immediately

---

## Notes

- The frontend works **without the backend** using mock data (demo mode)
- A banner shows when the backend is offline
- All data is tenant-scoped — the `x-tenant-slug` header is used in dev (defaults to first tenant)
- JWT tokens expire after 7 days

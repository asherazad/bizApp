/**
 * api/index.js
 * Vercel Serverless Function — wraps the Express app.
 * All /api/* requests are handled here.
 *
 * In development: Express runs as a standalone server on port 4000
 * In production:  This file is the Vercel serverless entry point
 */

// Load env from Vercel environment variables (set in Vercel dashboard)
// No need for dotenv in production — Vercel injects them automatically

const express = require('express')
const cors    = require('cors')

const app = express()

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  // Add your Vercel preview URLs pattern
  /\.vercel\.app$/,
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true) // curl / server-to-server
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    )
    cb(null, allowed)
  },
  credentials: true,
}))

app.use(express.json({ limit: '25mb' }))

// ── Database connection (Supabase PostgreSQL) ─────────────
// DATABASE_URL (manual) or POSTGRES_URL (Vercel Supabase integration)
const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL

const knex = require('knex')({
  client: 'pg',
  connection: {
    connectionString: DB_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  },
  pool: { min: 0, max: 2 }, // Serverless: keep pool small
})

// Make db available to route modules
app.locals.db = knex
global.__db = knex // fallback for modules that import db directly

// ── Routes ────────────────────────────────────────────────
const { resolveTenant, authenticate } = require('../server/middleware/auth')

app.use('/api/auth',        require('../server/routes/auth'))
app.use('/api/clients',     resolveTenant, authenticate, require('../server/routes/clients'))
app.use('/api/invoices',    resolveTenant, authenticate, require('../server/routes/invoices'))
app.use('/api/quotations',  resolveTenant, authenticate, require('../server/routes/quotations'))
app.use('/api/users',       resolveTenant, authenticate, require('../server/routes/users'))
app.use('/api/roles',       resolveTenant, authenticate, require('../server/routes/roles'))
app.use('/api/businesses',  resolveTenant, authenticate, require('../server/routes/businesses'))

app.get('/api/departments', resolveTenant, authenticate, async (req, res) => {
  try {
    const rows = await knex('departments').where({ tenant_id: req.tenant.id }).orderBy('name')
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/health', (req, res) => res.json({
  ok:  true,
  env: process.env.NODE_ENV,
  db:  DB_URL ? 'configured' : 'missing — set DATABASE_URL in Vercel env vars',
}))

// ── Global Express error handler ──────────────────────────
// Catches any unhandled error thrown inside route/middleware
app.use((err, req, res, _next) => {
  console.error('[API error]', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// ── Prevent Node 20 from crashing on unhandled rejections ─
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

// ── Export for Vercel ─────────────────────────────────────
module.exports = app

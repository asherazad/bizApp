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
// Uses DATABASE_URL from Vercel environment variables
const knex = require('knex')({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
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

app.use('/api/auth',       require('../server/routes/auth'))
app.use('/api/clients',    resolveTenant, authenticate, require('../server/routes/clients'))
app.use('/api/invoices',   resolveTenant, authenticate, require('../server/routes/invoices'))
app.use('/api/quotations', resolveTenant, authenticate, require('../server/routes/quotations'))

app.get('/api/departments', resolveTenant, authenticate, async (req, res) => {
  try {
    const rows = await knex('departments').where({ tenant_id: req.tenant.id }).orderBy('name')
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/health', (req, res) => res.json({
  ok:  true,
  env: process.env.NODE_ENV,
  db:  process.env.DATABASE_URL ? 'configured' : 'missing',
}))

// ── Export for Vercel ─────────────────────────────────────
module.exports = app

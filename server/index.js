require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const app     = express()

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '25mb' }))

const { resolveTenant, authenticate } = require('./middleware/auth')

app.use('/api/auth',        require('./routes/auth'))
app.use('/api/clients',     resolveTenant, authenticate, require('./routes/clients'))
app.use('/api/invoices',    resolveTenant, authenticate, require('./routes/invoices'))
app.use('/api/quotations',  resolveTenant, authenticate, require('./routes/quotations'))
app.use('/api/users',       resolveTenant, authenticate, require('./routes/users'))
app.use('/api/roles',       resolveTenant, authenticate, require('./routes/roles'))
app.use('/api/businesses',  resolveTenant, authenticate, require('./routes/businesses'))

app.get('/api/departments', resolveTenant, authenticate, async (req, res) => {
  try {
    const rows = await require('./db')('departments').where({ tenant_id: req.tenant.id }).orderBy('name')
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`BizPortal API → http://localhost:${PORT}`))

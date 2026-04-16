const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const db     = require('../db')
const { resolveTenant } = require('../middleware/auth')

// POST /auth/login
router.post('/login', resolveTenant, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = await db('users')
      .where({ tenant_id: req.tenant.id, email: email.toLowerCase(), is_active: true })
      .first()

    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    // Load permissions
    const roles = await db('user_roles as ur')
      .join('roles as r', 'r.id', 'ur.role_id')
      .where('ur.user_id', user.id)
      .select('r.name', 'r.permissions')

    const permissions = roles.reduce((acc, r) => ({ ...acc, ...r.permissions }), {})

    const token = jwt.sign(
      { id: user.id, tenantId: req.tenant.id, email: user.email, permissions },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    )

    await db('users').where({ id: user.id }).update({ last_login: new Date() })

    res.json({
      token,
      user: {
        id:            user.id,
        full_name:     user.full_name,
        email:         user.email,
        department_id: user.department_id,
        permissions,
      },
      tenant: req.tenant,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /auth/me — validate token + return current user
router.get('/me', resolveTenant, async (req, res) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' })
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret')
    const user    = await db('users').where({ id: payload.id }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user: { ...user, password_hash: undefined }, tenant: req.tenant })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

module.exports = router

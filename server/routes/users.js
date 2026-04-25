const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const { v4: uuid } = require('uuid')
const db      = require('../db')
const { requirePermission } = require('../middleware/auth')

// ── helpers ────────────────────────────────────────────────

async function userWithRoles(tenantId, userId) {
  const user = await db('users')
    .where({ 'users.tenant_id': tenantId, 'users.id': userId })
    .leftJoin('departments as d', 'd.id', 'users.department_id')
    .select('users.*', 'd.name as department_name')
    .first()

  if (!user) return null
  delete user.password_hash

  const roles = await db('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .where('ur.user_id', userId)
    .select('r.id', 'r.name', 'r.permissions', 'r.is_system')

  const businesses = await db('user_business_access as uba')
    .join('tenants as t', 't.id', 'uba.tenant_id')
    .where('uba.user_id', userId)
    .select('t.id', 't.name', 't.slug')

  return { ...user, roles, businesses }
}

// ── GET /users ─────────────────────────────────────────────
router.get('/', requirePermission('users', 'read'), async (req, res) => {
  try {
    const { search = '', status } = req.query

    let q = db('users')
      .where({ 'users.tenant_id': req.tenant.id })
      .leftJoin('departments as d', 'd.id', 'users.department_id')
      .select('users.id', 'users.full_name', 'users.email', 'users.is_active',
              'users.last_login', 'users.created_at', 'users.department_id',
              'd.name as department_name')
      .orderBy('users.full_name')

    if (search) {
      q = q.where(function () {
        this.whereRaw('users.full_name ILIKE ?', [`%${search}%`])
          .orWhereRaw('users.email ILIKE ?', [`%${search}%`])
      })
    }
    if (status === 'active')   q = q.where('users.is_active', true)
    if (status === 'inactive') q = q.where('users.is_active', false)

    const users = await q

    // Attach roles to each user in one query
    const ids = users.map(u => u.id)
    const allRoles = ids.length
      ? await db('user_roles as ur')
          .join('roles as r', 'r.id', 'ur.role_id')
          .whereIn('ur.user_id', ids)
          .select('ur.user_id', 'r.id', 'r.name')
      : []

    const roleMap = {}
    allRoles.forEach(r => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = []
      roleMap[r.user_id].push({ id: r.id, name: r.name })
    })

    res.json(users.map(u => ({ ...u, roles: roleMap[u.id] || [] })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /users/:id ─────────────────────────────────────────
router.get('/:id', requirePermission('users', 'read'), async (req, res) => {
  try {
    const user = await userWithRoles(req.tenant.id, req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /users ────────────────────────────────────────────
router.post('/', requirePermission('users', 'write'), async (req, res) => {
  try {
    const { full_name, email, password, department_id, role_ids = [] } = req.body
    if (!full_name || !email || !password)
      return res.status(400).json({ error: 'full_name, email and password are required' })

    const exists = await db('users')
      .where({ tenant_id: req.tenant.id, email: email.toLowerCase() })
      .first()
    if (exists) return res.status(409).json({ error: 'A user with this email already exists' })

    const password_hash = await bcrypt.hash(password, 12)
    const id = uuid()

    await db.transaction(async trx => {
      await trx('users').insert({
        id,
        tenant_id:     req.tenant.id,
        department_id: department_id || null,
        email:         email.toLowerCase(),
        password_hash,
        full_name,
        is_active:     true,
      })

      if (role_ids.length) {
        await trx('user_roles').insert(
          role_ids.map(role_id => ({
            user_id:     id,
            role_id,
            assigned_by: req.user.id,
          }))
        )
      }
    })

    const user = await userWithRoles(req.tenant.id, id)
    res.status(201).json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /users/:id ─────────────────────────────────────────
router.put('/:id', requirePermission('users', 'write'), async (req, res) => {
  try {
    const { full_name, email, department_id } = req.body

    const existing = await db('users')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .first()
    if (!existing) return res.status(404).json({ error: 'User not found' })

    if (email && email.toLowerCase() !== existing.email) {
      const conflict = await db('users')
        .where({ tenant_id: req.tenant.id, email: email.toLowerCase() })
        .whereNot('id', req.params.id)
        .first()
      if (conflict) return res.status(409).json({ error: 'Email already in use' })
    }

    const patch = {}
    if (full_name)    patch.full_name      = full_name
    if (email)        patch.email          = email.toLowerCase()
    if (department_id !== undefined) patch.department_id = department_id || null

    await db('users').where({ tenant_id: req.tenant.id, id: req.params.id }).update(patch)

    const user = await userWithRoles(req.tenant.id, req.params.id)
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /users/:id/password ──────────────────────────────
router.patch('/:id/password', requirePermission('users', 'write'), async (req, res) => {
  try {
    const { password } = req.body
    if (!password || password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const exists = await db('users')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .first()
    if (!exists) return res.status(404).json({ error: 'User not found' })

    const password_hash = await bcrypt.hash(password, 12)
    await db('users').where({ id: req.params.id }).update({ password_hash })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /users/:id/roles ─────────────────────────────────
router.patch('/:id/roles', requirePermission('users', 'write'), async (req, res) => {
  try {
    const { role_ids = [] } = req.body

    const exists = await db('users')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .first()
    if (!exists) return res.status(404).json({ error: 'User not found' })

    await db.transaction(async trx => {
      await trx('user_roles').where({ user_id: req.params.id }).del()
      if (role_ids.length) {
        await trx('user_roles').insert(
          role_ids.map(role_id => ({
            user_id:     req.params.id,
            role_id,
            assigned_by: req.user.id,
          }))
        )
      }
    })

    const user = await userWithRoles(req.tenant.id, req.params.id)
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /users/:id/status ────────────────────────────────
router.patch('/:id/status', requirePermission('users', 'write'), async (req, res) => {
  try {
    const { is_active } = req.body
    if (typeof is_active !== 'boolean')
      return res.status(400).json({ error: 'is_active must be a boolean' })

    // Prevent self-deactivation
    if (!is_active && req.params.id === req.user.id)
      return res.status(400).json({ error: 'You cannot deactivate your own account' })

    const exists = await db('users')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .first()
    if (!exists) return res.status(404).json({ error: 'User not found' })

    await db('users')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .update({ is_active })

    const user = await userWithRoles(req.tenant.id, req.params.id)
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /users/:id/businesses ───────────────────────────
router.patch('/:id/businesses', requirePermission('users', 'write'), async (req, res) => {
  try {
    const { tenant_ids = [] } = req.body

    const exists = await db('users')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .first()
    if (!exists) return res.status(404).json({ error: 'User not found' })

    await db.transaction(async trx => {
      await trx('user_business_access').where({ user_id: req.params.id }).del()
      if (tenant_ids.length) {
        await trx('user_business_access').insert(
          tenant_ids.map(tid => ({
            user_id:    req.params.id,
            tenant_id:  tid,
            granted_by: req.user.id,
          }))
        )
      }
    })

    const user = await userWithRoles(req.tenant.id, req.params.id)
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

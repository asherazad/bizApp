const router = require('express').Router()
const { v4: uuid } = require('uuid')
const db     = require('../db')
const { requirePermission } = require('../middleware/auth')

// All business routes require admin (businesses:* permission)
const requireAdmin = requirePermission('businesses', 'read')
const requireAdminWrite = requirePermission('businesses', 'write')

// ── GET /businesses ────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    const businesses = await db('tenants').orderBy('name')

    // Attach user counts
    const counts = await db('users')
      .groupBy('tenant_id')
      .select('tenant_id', db.raw('count(*) as user_count'))

    const countMap = {}
    counts.forEach(c => { countMap[c.tenant_id] = parseInt(c.user_count, 10) })

    res.json(businesses.map(b => ({ ...b, user_count: countMap[b.id] || 0 })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /businesses/:id ────────────────────────────────────
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const business = await db('tenants').where({ id: req.params.id }).first()
    if (!business) return res.status(404).json({ error: 'Business not found' })

    // Users who have access to this business (cross-access) + native users
    const nativeUsers = await db('users')
      .where({ tenant_id: req.params.id, is_active: true })
      .select('id', 'full_name', 'email')

    const accessUsers = await db('user_business_access as uba')
      .join('users as u', 'u.id', 'uba.user_id')
      .where({ 'uba.tenant_id': req.params.id })
      .select('u.id', 'u.full_name', 'u.email', 'uba.granted_at')

    res.json({ ...business, native_users: nativeUsers, access_users: accessUsers })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /businesses ───────────────────────────────────────
router.post('/', requireAdminWrite, async (req, res) => {
  try {
    const { name, slug, plan = 'starter' } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Business name is required' })
    if (!slug?.trim()) return res.status(400).json({ error: 'Slug is required' })

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')

    const exists = await db('tenants').where({ slug: cleanSlug }).first()
    if (exists) return res.status(409).json({ error: 'A business with this slug already exists' })

    const [business] = await db('tenants')
      .insert({
        id:        uuid(),
        name:      name.trim(),
        slug:      cleanSlug,
        plan,
        is_active: true,
      })
      .returning('*')

    res.status(201).json({ ...business, user_count: 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /businesses/:id ────────────────────────────────────
router.put('/:id', requireAdminWrite, async (req, res) => {
  try {
    const business = await db('tenants').where({ id: req.params.id }).first()
    if (!business) return res.status(404).json({ error: 'Business not found' })

    const { name, plan } = req.body
    const patch = {}
    if (name?.trim()) patch.name = name.trim()
    if (plan)         patch.plan = plan

    const [updated] = await db('tenants')
      .where({ id: req.params.id })
      .update(patch)
      .returning('*')

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /businesses/:id/status ───────────────────────────
router.patch('/:id/status', requireAdminWrite, async (req, res) => {
  try {
    const { is_active } = req.body
    if (typeof is_active !== 'boolean')
      return res.status(400).json({ error: 'is_active must be a boolean' })

    const business = await db('tenants').where({ id: req.params.id }).first()
    if (!business) return res.status(404).json({ error: 'Business not found' })

    const [updated] = await db('tenants')
      .where({ id: req.params.id })
      .update({ is_active })
      .returning('*')

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /businesses/:id/assigned-users ────────────────────
router.get('/:id/assigned-users', requireAdmin, async (req, res) => {
  try {
    const rows = await db('user_business_access as uba')
      .join('users as u', 'u.id', 'uba.user_id')
      .where({ 'uba.tenant_id': req.params.id })
      .select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'uba.granted_at', 'uba.granted_by')

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /businesses/:id/assign-user ──────────────────────
router.post('/:id/assign-user', requireAdminWrite, async (req, res) => {
  try {
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id is required' })

    const business = await db('tenants').where({ id: req.params.id }).first()
    if (!business) return res.status(404).json({ error: 'Business not found' })

    const user = await db('users').where({ id: user_id, is_active: true }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })

    await db('user_business_access')
      .insert({ user_id, tenant_id: req.params.id, granted_by: req.user.id })
      .onConflict(['user_id', 'tenant_id'])
      .ignore()

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /businesses/:id/assign-user/:userId ─────────────
router.delete('/:id/assign-user/:userId', requireAdminWrite, async (req, res) => {
  try {
    await db('user_business_access')
      .where({ user_id: req.params.userId, tenant_id: req.params.id })
      .del()

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

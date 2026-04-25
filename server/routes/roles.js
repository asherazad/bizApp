const router = require('express').Router()
const { v4: uuid } = require('uuid')
const db     = require('../db')
const { requirePermission } = require('../middleware/auth')

// ── GET /roles ─────────────────────────────────────────────
router.get('/', requirePermission('roles', 'read'), async (req, res) => {
  try {
    const roles = await db('roles')
      .where({ tenant_id: req.tenant.id })
      .orderByRaw("is_system DESC, name ASC")

    // Attach user count per role
    const ids = roles.map(r => r.id)
    const counts = ids.length
      ? await db('user_roles')
          .whereIn('role_id', ids)
          .groupBy('role_id')
          .select('role_id', db.raw('count(*) as user_count'))
      : []

    const countMap = {}
    counts.forEach(c => { countMap[c.role_id] = parseInt(c.user_count, 10) })

    res.json(roles.map(r => ({ ...r, user_count: countMap[r.id] || 0 })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /roles ────────────────────────────────────────────
router.post('/', requirePermission('roles', 'write'), async (req, res) => {
  try {
    const { name, permissions = {} } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Role name is required' })

    const exists = await db('roles')
      .where({ tenant_id: req.tenant.id, name: name.trim() })
      .first()
    if (exists) return res.status(409).json({ error: 'A role with this name already exists' })

    const [role] = await db('roles')
      .insert({
        id:          uuid(),
        tenant_id:   req.tenant.id,
        name:        name.trim(),
        permissions: JSON.stringify(permissions),
        is_system:   false,
      })
      .returning('*')

    res.status(201).json({ ...role, user_count: 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /roles/:id ─────────────────────────────────────────
router.put('/:id', requirePermission('roles', 'write'), async (req, res) => {
  try {
    const role = await db('roles')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .first()
    if (!role) return res.status(404).json({ error: 'Role not found' })

    const { name, permissions } = req.body
    const patch = {}

    if (!role.is_system && name?.trim()) {
      const conflict = await db('roles')
        .where({ tenant_id: req.tenant.id, name: name.trim() })
        .whereNot('id', req.params.id)
        .first()
      if (conflict) return res.status(409).json({ error: 'Name already taken' })
      patch.name = name.trim()
    }

    if (permissions !== undefined && !role.is_system) {
      patch.permissions = JSON.stringify(permissions)
    } else if (permissions !== undefined && role.is_system) {
      // System roles: only allow updating permissions, not the name
      patch.permissions = JSON.stringify(permissions)
    }

    const [updated] = await db('roles')
      .where({ id: req.params.id })
      .update(patch)
      .returning('*')

    const [countRow] = await db('user_roles')
      .where({ role_id: req.params.id })
      .count('* as user_count')

    res.json({ ...updated, user_count: parseInt(countRow.user_count, 10) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /roles/:id ──────────────────────────────────────
router.delete('/:id', requirePermission('roles', 'delete'), async (req, res) => {
  try {
    const role = await db('roles')
      .where({ tenant_id: req.tenant.id, id: req.params.id })
      .first()
    if (!role) return res.status(404).json({ error: 'Role not found' })
    if (role.is_system) return res.status(400).json({ error: 'System roles cannot be deleted' })

    await db('roles').where({ id: req.params.id }).del()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

const jwt  = require('jsonwebtoken')
const db   = require('../db')

// ─── Resolve tenant from slug (subdomain or header) ───────
async function resolveTenant(req, res, next) {
  // Support: x-tenant-slug header (dev) or subdomain (prod)
  const slug = req.headers['x-tenant-slug'] || req.hostname.split('.')[0]

  if (!slug || slug === 'localhost' || slug === '127') {
    // Dev fallback — use first active tenant
    const tenant = await db('tenants').where({ is_active: true }).first()
    if (!tenant) return res.status(404).json({ error: 'No tenant found' })
    req.tenant = tenant
    return next()
  }

  const tenant = await db('tenants').where({ slug, is_active: true }).first()
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  req.tenant = tenant
  next()
}

// ─── Authenticate JWT ──────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing token' })

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    // Enforce tenant isolation
    if (req.tenant && payload.tenantId !== req.tenant.id)
      return res.status(403).json({ error: 'Token does not match tenant' })
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── RBAC permission check ────────────────────────────────
function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      const roles = await db('user_roles as ur')
        .join('roles as r', 'r.id', 'ur.role_id')
        .where('ur.user_id', req.user.id)
        .select('r.permissions')

      const allowed = roles.some(r => {
        const perms = r.permissions
        const all   = perms['*'] || []
        if (all.includes('*') || all.includes(action)) return true
        const res_perms = perms[resource] || []
        return res_perms.includes(action) || res_perms.includes('*')
      })

      if (!allowed) return res.status(403).json({ error: 'Permission denied' })
      next()
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
}

module.exports = { resolveTenant, authenticate, requirePermission }

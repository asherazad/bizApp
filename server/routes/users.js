const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildGrants(userId, wingAccess = []) {
  return wingAccess.map((g) => ({
    user_id:          userId,
    business_wing_id: g.wing_id,
    permissions:      JSON.stringify(g.permissions || {}),
  }));
}

// ── Admin: list all users ──────────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users  = await db('users')
      .select('id', 'full_name', 'email', 'role', 'is_active', 'created_at')
      .orderBy('full_name');
    const grants = await db('wing_access_grants')
      .select('user_id', 'business_wing_id', 'permissions');

    res.json(users.map((u) => {
      const userGrants = grants.filter((g) => g.user_id === u.id);
      return {
        ...u,
        name:        u.full_name,
        wing_ids:    userGrants.map((g) => g.business_wing_id),
        wing_access: userGrants.map((g) => ({
          wing_id:     g.business_wing_id,
          permissions: g.permissions || {},
        })),
      };
    }));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: create user ─────────────────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { full_name, email, password, role, wing_ids = [], wing_access } = req.body;
    if (!full_name || !email || !password)
      return res.status(400).json({ error: 'full_name, email, password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // wing_access (new format) takes priority over wing_ids (legacy)
    const grants = wing_access || wing_ids.map((wid) => ({ wing_id: wid, permissions: {} }));

    const hash = await bcrypt.hash(password, 12);
    const user = await db.transaction(async (trx) => {
      const [u] = await trx('users').insert({
        full_name,
        email:    email.toLowerCase().trim(),
        password_hash: hash,
        role:     role || 'viewer',
      }).returning('*');
      if (grants.length) {
        await trx('wing_access_grants').insert(buildGrants(u.id, grants));
      }
      return u;
    });

    const { password_hash, ...safe } = user;
    res.status(201).json({ ...safe, name: safe.full_name, wing_access: grants });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── Update user ────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const isSelf  = req.params.id === String(req.user.id);
  if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { full_name, email, role, is_active, wing_ids, wing_access } = req.body;

    if (isSelf && isAdmin) {
      if (role && role !== 'admin')
        return res.status(400).json({ error: 'You cannot change your own role' });
      if (is_active === false)
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email     !== undefined) updates.email     = email.toLowerCase().trim();
    if (isAdmin) {
      if (role      !== undefined) updates.role      = role;
      if (is_active !== undefined) updates.is_active = is_active;
    }

    // wing_access (new format) takes priority over wing_ids (legacy)
    const newAccess = wing_access !== undefined ? wing_access
      : wing_ids !== undefined ? wing_ids.map((wid) => ({ wing_id: wid, permissions: {} }))
      : null;

    const user = await db.transaction(async (trx) => {
      const [u] = await trx('users').where({ id: req.params.id }).update(updates).returning('*');
      if (!u) return null;
      if (isAdmin && newAccess !== null) {
        await trx('wing_access_grants').where({ user_id: req.params.id }).delete();
        if (newAccess.length) {
          await trx('wing_access_grants').insert(buildGrants(req.params.id, newAccess));
        }
      }
      return u;
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safe } = user;
    res.json({ ...safe, name: safe.full_name });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── Reset password ─────────────────────────────────────────────────────────────
router.put('/:id/reset-password', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const isSelf  = req.params.id === String(req.user.id);
  if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { new_password, confirm_password } = req.body;
    if (!new_password)                    return res.status(400).json({ error: 'new_password is required' });
    if (new_password.length < 8)          return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (new_password !== confirm_password) return res.status(400).json({ error: 'Passwords do not match' });

    const hash  = await bcrypt.hash(new_password, 12);
    const count = await db('users').where({ id: req.params.id }).update({ password_hash: hash });
    if (!count) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: delete user ─────────────────────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  if (req.params.id === String(req.user.id))
    return res.status(400).json({ error: 'You cannot delete your own account' });
  try {
    const count = await db('users').where({ id: req.params.id }).delete();
    if (!count) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

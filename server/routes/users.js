const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// ── Admin: list all users ──────────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users  = await db('users').select('id', 'full_name', 'email', 'role', 'is_active', 'created_at').orderBy('full_name');
    const grants = await db('wing_access_grants').select('user_id', 'business_wing_id');
    res.json(users.map((u) => ({
      ...u,
      name:     u.full_name,
      wing_ids: grants.filter((g) => g.user_id === u.id).map((g) => g.business_wing_id),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: create user ─────────────────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { full_name, email, password, role, wing_ids = [] } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: 'full_name, email, password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hash = await bcrypt.hash(password, 12);
    const user = await db.transaction(async (trx) => {
      const [u] = await trx('users').insert({
        full_name, email: email.toLowerCase().trim(), password_hash: hash, role: role || 'viewer',
      }).returning('*');
      if (wing_ids.length) {
        await trx('wing_access_grants').insert(wing_ids.map((wid) => ({ user_id: u.id, business_wing_id: wid })));
      }
      return u;
    });
    const { password_hash, ...safe } = user;
    res.status(201).json({ ...safe, name: safe.full_name });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── Update user — admin can update anyone, user can only update own name/email ─
router.put('/:id', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const isSelf  = req.params.id === String(req.user.id);

  if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { full_name, email, role, is_active, wing_ids } = req.body;

    // Self-protection for admins
    if (isSelf && isAdmin) {
      if (role && role !== 'admin')   return res.status(400).json({ error: 'You cannot change your own role' });
      if (is_active === false)        return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email     !== undefined) updates.email     = email.toLowerCase().trim();
    // Role, status and wings are admin-only fields
    if (isAdmin) {
      if (role      !== undefined) updates.role      = role;
      if (is_active !== undefined) updates.is_active = is_active;
    }

    const user = await db.transaction(async (trx) => {
      const [u] = await trx('users').where({ id: req.params.id }).update(updates).returning('*');
      if (!u) return null;
      if (isAdmin && wing_ids !== undefined) {
        await trx('wing_access_grants').where({ user_id: req.params.id }).delete();
        if (wing_ids.length) {
          await trx('wing_access_grants').insert(wing_ids.map((wid) => ({ user_id: req.params.id, business_wing_id: wid })));
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

// ── Reset password — admin resets anyone, user resets own (no current_pw needed here for admin) ─
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
  if (req.params.id === String(req.user.id)) return res.status(400).json({ error: 'You cannot delete your own account' });
  try {
    const count = await db('users').where({ id: req.params.id }).delete();
    if (!count) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

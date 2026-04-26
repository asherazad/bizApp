const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const users = await db('users').select('id','name','email','role','is_active','created_at').orderBy('name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, wing_ids = [] } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const hash = await bcrypt.hash(password, 10);
    const user = await db.transaction(async (trx) => {
      const [u] = await trx('users').insert({ name, email: email.toLowerCase(), password_hash: hash, role: role || 'viewer' }).returning('*');
      if (wing_ids.length) {
        await trx('user_wings').insert(wing_ids.map((wid) => ({ user_id: u.id, wing_id: wid })));
      }
      return u;
    });
    const { password_hash, ...safe } = user;
    res.status(201).json(safe);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, role, is_active, wing_ids } = req.body;
    const user = await db.transaction(async (trx) => {
      const [u] = await trx('users').where({ id: req.params.id })
        .update({ name, role, is_active, updated_at: new Date() }).returning('*');
      if (wing_ids !== undefined) {
        await trx('user_wings').where({ user_id: req.params.id }).delete();
        if (wing_ids.length) {
          await trx('user_wings').insert(wing_ids.map((wid) => ({ user_id: req.params.id, wing_id: wid })));
        }
      }
      return u;
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/reset-password', async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: req.params.id }).update({ password_hash: hash, updated_at: new Date() });
    res.json({ message: 'Password reset' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

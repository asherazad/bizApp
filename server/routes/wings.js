const router = require('express').Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    let query = db('business_wings').orderBy('name');
    if (req.user.role !== 'admin') {
      const wingIds = await db('user_wings').where('user_id', req.user.id).pluck('wing_id');
      query = query.whereIn('id', wingIds);
    }
    const wings = await query;
    res.json(wings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const wing = await db('business_wings').where({ id: req.params.id }).first();
    if (!wing) return res.status(404).json({ error: 'Wing not found' });
    res.json(wing);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });

    const [wing] = await db('business_wings').insert({
      name, code: code.toUpperCase(), description,
    }).returning('*');
    res.status(201).json(wing);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Wing code already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;
    const [wing] = await db('business_wings').where({ id: req.params.id })
      .update({ name, code: code?.toUpperCase(), description, is_active, updated_at: new Date() })
      .returning('*');
    if (!wing) return res.status(404).json({ error: 'Wing not found' });
    res.json(wing);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const count = await db('business_wings').where({ id: req.params.id }).delete();
    if (!count) return res.status(404).json({ error: 'Wing not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Wing has linked records and cannot be deleted' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Wing users management
router.get('/:id/users', requireAdmin, async (req, res) => {
  try {
    const users = await db('user_wings')
      .join('users', 'users.id', 'user_wings.user_id')
      .where('user_wings.wing_id', req.params.id)
      .select('users.id', 'users.name', 'users.email', 'users.role');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

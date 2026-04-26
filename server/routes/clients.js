const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, type, search } = req.query;
    let q = db('clients').orderBy('name');
    if (wing_id) q = q.where('wing_id', wing_id);
    if (type)    q = q.where('type', type);
    if (search)  q = q.whereRaw('name ILIKE ?', [`%${search}%`]);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await db('clients').where({ id: req.params.id }).first();
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, name, email, phone, address, ntn, strn, type } = req.body;
    if (!wing_id || !name) return res.status(400).json({ error: 'wing_id and name are required' });
    const [client] = await db('clients').insert({ wing_id, name, email, phone, address, ntn, strn, type: type || 'client' }).returning('*');
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, address, ntn, strn, type, is_active } = req.body;
    const [client] = await db('clients').where({ id: req.params.id })
      .update({ name, email, phone, address, ntn, strn, type, is_active, updated_at: new Date() })
      .returning('*');
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('clients').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Client has linked records' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

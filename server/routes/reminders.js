const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, category, is_completed } = req.query;
    let q = db('reminders')
      .leftJoin('business_wings', 'business_wings.id', 'reminders.wing_id')
      .select('reminders.*', 'business_wings.name as wing_name')
      .orderBy('reminders.due_at');
    if (wing_id)      q = q.where('reminders.wing_id', wing_id);
    if (category)     q = q.where('reminders.category', category);
    if (is_completed !== undefined) q = q.where('reminders.is_completed', is_completed === 'true');
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const upcoming = await db('reminders')
      .where('is_completed', false)
      .where('due_at', '<=', db.raw("NOW() + INTERVAL '7 days'"))
      .orderBy('due_at');
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, title, description, due_at, category, priority, is_recurring, recurrence_pattern } = req.body;
    if (!title || !due_at) return res.status(400).json({ error: 'title and due_at are required' });
    const [reminder] = await db('reminders').insert({
      wing_id, title, description, due_at,
      category: category || 'general',
      priority: priority || 'medium',
      is_recurring: !!is_recurring, recurrence_pattern,
    }).returning('*');
    res.status(201).json(reminder);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, due_at, category, priority, is_completed } = req.body;
    const completed_at = is_completed ? new Date() : null;
    const [reminder] = await db('reminders').where({ id: req.params.id })
      .update({ title, description, due_at, category, priority, is_completed, completed_at, updated_at: new Date() })
      .returning('*');
    if (!reminder) return res.status(404).json({ error: 'Not found' });
    res.json(reminder);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('reminders').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, category, status } = req.query;
    let q = db('reminders')
      .leftJoin('business_wings', 'business_wings.id', 'reminders.business_wing_id')
      .select('reminders.*', 'business_wings.name as wing_name')
      .orderBy('reminders.reminder_date');
    if (wing_id)  q = q.where('reminders.business_wing_id', wing_id);
    if (category) q = q.where('reminders.category', category);
    if (status)   q = q.where('reminders.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const { wing_id } = req.query;
    let q = db('reminders')
      .where('status', 'Active')
      .where('reminder_date', '<=', db.raw("CURRENT_DATE + INTERVAL '7 days'"))
      .orderBy('reminder_date');
    if (wing_id) q = q.where('business_wing_id', wing_id);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, title, description, reminder_date, recurrence, recurrence_day, lead_time_days, category, linked_module, linked_record_id } = req.body;
    if (!title || !reminder_date) return res.status(400).json({ error: 'title and reminder_date are required' });
    const [reminder] = await db('reminders').insert({
      business_wing_id: wing_id || null,
      title, description, reminder_date,
      recurrence: recurrence || 'Once',
      recurrence_day, lead_time_days: lead_time_days || 7,
      category, linked_module, linked_record_id,
    }).returning('*');
    res.status(201).json(reminder);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, reminder_date, category, status } = req.body;
    const [reminder] = await db('reminders').where({ id: req.params.id })
      .update({ title, description, reminder_date, category, status })
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

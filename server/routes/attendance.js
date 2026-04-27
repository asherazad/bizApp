const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, from, to, status } = req.query;
    let q = db('attendance_records')
      .join('resources', 'resources.id', 'attendance_records.resource_id')
      .select('attendance_records.*', 'resources.full_name as resource_name', 'resources.business_wing_id')
      .orderBy('attendance_records.record_date', 'desc');
    if (wing_id)     q = q.where('resources.business_wing_id', wing_id);
    if (resource_id) q = q.where('attendance_records.resource_id', resource_id);
    if (status)      q = q.where('attendance_records.status', status);
    if (from)        q = q.where('attendance_records.record_date', '>=', from);
    if (to)          q = q.where('attendance_records.record_date', '<=', to);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { resource_id, record_date, status, leave_type, check_in, check_out, notes } = req.body;
    if (!resource_id || !record_date || !status) {
      return res.status(400).json({ error: 'resource_id, record_date, status required' });
    }
    const [row] = await db('attendance_records').insert({
      resource_id, record_date, status, leave_type, check_in, check_out, notes,
    }).returning('*');
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Attendance already recorded for this date' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, leave_type, check_in, check_out, notes } = req.body;
    const [row] = await db('attendance_records').where({ id: req.params.id })
      .update({ status, leave_type, check_in, check_out, notes })
      .returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('attendance_records').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Leave Balances ───────────────────────────────────────────────────────────

router.get('/leave-balances', async (req, res) => {
  try {
    const { resource_id, year } = req.query;
    let q = db('leave_balances')
      .join('resources', 'resources.id', 'leave_balances.resource_id')
      .select('leave_balances.*', 'resources.full_name as resource_name');
    if (resource_id) q = q.where('leave_balances.resource_id', resource_id);
    if (year)        q = q.where('leave_balances.year', year);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

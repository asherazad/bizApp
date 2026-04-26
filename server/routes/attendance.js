const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, from, to, status } = req.query;
    let q = db('attendance')
      .join('resources', 'resources.id', 'attendance.resource_id')
      .select('attendance.*', 'resources.name as resource_name')
      .orderBy('attendance.date', 'desc');
    if (wing_id)     q = q.where('attendance.wing_id', wing_id);
    if (resource_id) q = q.where('attendance.resource_id', resource_id);
    if (status)      q = q.where('attendance.status', status);
    if (from)        q = q.where('attendance.date', '>=', from);
    if (to)          q = q.where('attendance.date', '<=', to);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { resource_id, wing_id, date, check_in, check_out, status, overtime_hours, notes } = req.body;
    if (!resource_id || !wing_id || !date) return res.status(400).json({ error: 'resource_id, wing_id, date required' });
    const [row] = await db('attendance').insert({
      resource_id, wing_id, date, check_in, check_out,
      status: status || 'present',
      overtime_hours: overtime_hours || 0, notes,
    }).returning('*');
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Attendance already recorded for this date' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { check_in, check_out, status, overtime_hours, notes } = req.body;
    const [row] = await db('attendance').where({ id: req.params.id })
      .update({ check_in, check_out, status, overtime_hours, notes, updated_at: new Date() })
      .returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave requests
router.get('/leaves', async (req, res) => {
  try {
    const { wing_id, resource_id, status } = req.query;
    let q = db('leave_requests')
      .join('resources', 'resources.id', 'leave_requests.resource_id')
      .select('leave_requests.*', 'resources.name as resource_name')
      .orderBy('leave_requests.start_date', 'desc');
    if (wing_id)     q = q.where('leave_requests.wing_id', wing_id);
    if (resource_id) q = q.where('leave_requests.resource_id', resource_id);
    if (status)      q = q.where('leave_requests.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/leaves', async (req, res) => {
  try {
    const { resource_id, wing_id, leave_type, start_date, end_date, days, reason } = req.body;
    if (!resource_id || !wing_id || !leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const [lr] = await db('leave_requests').insert({
      resource_id, wing_id, leave_type, start_date, end_date,
      days: days || 1, reason,
    }).returning('*');
    res.status(201).json(lr);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/leaves/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const [lr] = await db('leave_requests').where({ id: req.params.id })
      .update({ status, notes, updated_at: new Date() }).returning('*');
    if (!lr) return res.status(404).json({ error: 'Not found' });
    res.json(lr);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

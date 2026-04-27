const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, status, from, to } = req.query;
    let q = db('travel_records')
      .join('resources', 'resources.id', 'travel_records.resource_id')
      .leftJoin('business_wings', 'business_wings.id', 'travel_records.business_wing_id')
      .select('travel_records.*', 'resources.full_name as resource_name', 'business_wings.name as wing_name')
      .orderBy('travel_records.travel_date', 'desc');
    if (wing_id)     q = q.where('travel_records.business_wing_id', wing_id);
    if (resource_id) q = q.where('travel_records.resource_id', resource_id);
    if (status)      q = q.where('travel_records.status', status);
    if (from)        q = q.where('travel_records.travel_date', '>=', from);
    if (to)          q = q.where('travel_records.travel_date', '<=', to);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, resource_id, travel_date, from_location, to_location, purpose, mode, distance_km, amount, bank_account_id, notes } = req.body;
    if (!wing_id || !resource_id || !travel_date) {
      return res.status(400).json({ error: 'wing_id, resource_id, travel_date required' });
    }
    const [record] = await db('travel_records').insert({
      business_wing_id: wing_id, resource_id, travel_date,
      from_location, to_location, purpose, mode,
      distance_km: distance_km || null,
      amount: parseFloat(amount) || 0,
      bank_account_id, notes,
    }).returning('*');
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, payment_date, bank_account_id, amount, notes } = req.body;
    const [record] = await db('travel_records').where({ id: req.params.id })
      .update({ status, payment_date, bank_account_id, amount, notes })
      .returning('*');
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('travel_records').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

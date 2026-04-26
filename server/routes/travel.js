const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, from, to } = req.query;
    let q = db('travel_records')
      .leftJoin('resources', 'resources.id', 'travel_records.resource_id')
      .leftJoin('business_wings', 'business_wings.id', 'travel_records.wing_id')
      .select('travel_records.*', 'resources.name as resource_name', 'business_wings.name as wing_name')
      .orderBy('travel_records.departure_date', 'desc');
    if (wing_id)     q = q.where('travel_records.wing_id', wing_id);
    if (resource_id) q = q.where('travel_records.resource_id', resource_id);
    if (from)        q = q.where('travel_records.departure_date', '>=', from);
    if (to)          q = q.where('travel_records.departure_date', '<=', to);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, resource_id, destination, purpose, departure_date, return_date, total_cost, currency_code, exchange_rate, bank_account_id, notes } = req.body;
    if (!wing_id || !destination || !departure_date) return res.status(400).json({ error: 'Required fields missing' });
    const rate = parseFloat(exchange_rate) || 1;
    const cost = parseFloat(total_cost) || 0;
    const pkr  = (currency_code === 'PKR') ? cost : cost * rate;
    const [record] = await db('travel_records').insert({
      wing_id, resource_id, destination, purpose, departure_date, return_date,
      total_cost: cost, currency_code: currency_code || 'PKR',
      exchange_rate: rate, pkr_cost: pkr, bank_account_id, notes,
    }).returning('*');
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { return_date, total_cost, currency_code, exchange_rate, bank_account_id, notes } = req.body;
    const rate = parseFloat(exchange_rate) || 1;
    const cost = parseFloat(total_cost) || 0;
    const pkr  = (currency_code === 'PKR') ? cost : cost * rate;
    const [record] = await db('travel_records').where({ id: req.params.id })
      .update({ return_date, total_cost: cost, currency_code, exchange_rate: rate, pkr_cost: pkr, bank_account_id, notes, updated_at: new Date() })
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

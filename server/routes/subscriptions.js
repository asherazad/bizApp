const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, status } = req.query;
    let q = db('subscriptions')
      .leftJoin('business_wings', 'business_wings.id', 'subscriptions.business_wing_id')
      .select('subscriptions.*', 'business_wings.name as wing_name')
      .orderBy('subscriptions.next_renewal_date');
    if (wing_id) q = q.where('subscriptions.business_wing_id', wing_id);
    if (status)  q = q.where('subscriptions.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const { wing_id } = req.query;
    let q = db('subscriptions')
      .where('status', 'Active')
      .where('next_renewal_date', '<=', db.raw("CURRENT_DATE + INTERVAL '30 days'"))
      .orderBy('next_renewal_date');
    if (wing_id) q = q.where('business_wing_id', wing_id);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, service_name, vendor, amount, currency, billing_cycle, start_date, next_renewal_date, bank_account_id, payment_method, reminder_days_before, notes } = req.body;
    if (!wing_id || !service_name || !amount || !next_renewal_date) {
      return res.status(400).json({ error: 'wing_id, service_name, amount, next_renewal_date required' });
    }
    const [sub] = await db('subscriptions').insert({
      business_wing_id: wing_id,
      service_name, vendor, amount: parseFloat(amount),
      currency: currency || 'USD',
      billing_cycle: billing_cycle || 'Monthly',
      start_date, next_renewal_date,
      bank_account_id, payment_method,
      reminder_days_before: reminder_days_before || 7,
      notes,
    }).returning('*');
    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { service_name, amount, next_renewal_date, status, bank_account_id, notes } = req.body;
    const [sub] = await db('subscriptions').where({ id: req.params.id })
      .update({ service_name, amount, next_renewal_date, status, bank_account_id, notes })
      .returning('*');
    if (!sub) return res.status(404).json({ error: 'Not found' });
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('subscriptions').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

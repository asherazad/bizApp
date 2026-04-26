const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, is_active } = req.query;
    let q = db('subscriptions')
      .leftJoin('business_wings', 'business_wings.id', 'subscriptions.wing_id')
      .select('subscriptions.*', 'business_wings.name as wing_name')
      .orderBy('subscriptions.next_billing_date');
    if (wing_id)   q = q.where('subscriptions.wing_id', wing_id);
    if (is_active !== undefined) q = q.where('subscriptions.is_active', is_active === 'true');
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const upcoming = await db('subscriptions')
      .where('is_active', true)
      .where('next_billing_date', '<=', db.raw("CURRENT_DATE + INTERVAL '30 days'"))
      .orderBy('next_billing_date');
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, service_name, description, amount, currency_code, exchange_rate, billing_cycle, next_billing_date, bank_account_id, notes } = req.body;
    if (!wing_id || !service_name || !amount || !next_billing_date) return res.status(400).json({ error: 'Required fields missing' });
    const rate = parseFloat(exchange_rate) || 1;
    const amt  = parseFloat(amount);
    const pkr  = (currency_code === 'PKR') ? amt : amt * rate;
    const [sub] = await db('subscriptions').insert({
      wing_id, service_name, description, amount: amt,
      currency_code: currency_code || 'PKR', exchange_rate: rate, pkr_amount: pkr,
      billing_cycle: billing_cycle || 'monthly', next_billing_date, bank_account_id, notes,
    }).returning('*');
    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { service_name, amount, next_billing_date, is_active, notes } = req.body;
    const [sub] = await db('subscriptions').where({ id: req.params.id })
      .update({ service_name, amount, next_billing_date, is_active, notes, updated_at: new Date() })
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

const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, status, category, from, to } = req.query;
    let q = db('bills')
      .leftJoin('clients', 'clients.id', 'bills.vendor_id')
      .leftJoin('business_wings', 'business_wings.id', 'bills.wing_id')
      .select('bills.*', 'clients.name as vendor_name', 'business_wings.name as wing_name')
      .orderBy('bills.bill_date', 'desc');
    if (wing_id)  q = q.where('bills.wing_id', wing_id);
    if (status)   q = q.where('bills.status', status);
    if (category) q = q.where('bills.category', category);
    if (from)     q = q.where('bills.bill_date', '>=', from);
    if (to)       q = q.where('bills.bill_date', '<=', to);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, vendor_id, bill_number, category, amount, currency_code, exchange_rate, bill_date, due_date, bank_account_id, notes } = req.body;
    if (!wing_id || !category || !amount || !bill_date) return res.status(400).json({ error: 'Required fields missing' });
    const rate = parseFloat(exchange_rate) || 1;
    const pkr  = (currency_code === 'PKR') ? amount : amount * rate;
    const [bill] = await db('bills').insert({
      wing_id, vendor_id, bill_number, category, amount,
      currency_code: currency_code || 'PKR', exchange_rate: rate, pkr_amount: pkr,
      bill_date, due_date, bank_account_id, notes,
    }).returning('*');
    res.status(201).json(bill);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, paid_date, bank_account_id, notes } = req.body;
    const [bill] = await db('bills').where({ id: req.params.id })
      .update({ status, paid_date, bank_account_id, notes, updated_at: new Date() })
      .returning('*');
    if (!bill) return res.status(404).json({ error: 'Not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('bills').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

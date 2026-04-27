const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, status, bill_type } = req.query;
    let q = db('bill_payments')
      .leftJoin('business_wings', 'business_wings.id', 'bill_payments.business_wing_id')
      .select('bill_payments.*', 'business_wings.name as wing_name')
      .orderBy('bill_payments.due_date', 'desc');
    if (wing_id)   q = q.where('bill_payments.business_wing_id', wing_id);
    if (status)    q = q.where('bill_payments.status', status);
    if (bill_type) q = q.where('bill_payments.bill_type', bill_type);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, bill_type, description, bill_date, due_date, amount, bank_account_id, reference, notes } = req.body;
    if (!wing_id || !bill_type || !description || !due_date || !amount) {
      return res.status(400).json({ error: 'wing_id, bill_type, description, due_date, amount required' });
    }
    const [bill] = await db('bill_payments').insert({
      business_wing_id: wing_id,
      bill_type, description, bill_date, due_date,
      amount: parseFloat(amount),
      bank_account_id, reference, notes,
    }).returning('*');
    res.status(201).json(bill);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, payment_date, bank_account_id, reference, notes } = req.body;
    const [bill] = await db('bill_payments').where({ id: req.params.id })
      .update({ status, payment_date, bank_account_id, reference, notes })
      .returning('*');
    if (!bill) return res.status(404).json({ error: 'Not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('bill_payments').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, tax_type, status } = req.query;
    let q = db('tax_challans')
      .leftJoin('business_wings', 'business_wings.id', 'tax_challans.wing_id')
      .select('tax_challans.*', 'business_wings.name as wing_name')
      .orderBy('tax_challans.due_date', 'desc');
    if (wing_id)  q = q.where('tax_challans.wing_id', wing_id);
    if (tax_type) q = q.where('tax_challans.tax_type', tax_type);
    if (status)   q = q.where('tax_challans.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const upcoming = await db('tax_challans')
      .where('status', 'pending')
      .where('due_date', '<=', db.raw("CURRENT_DATE + INTERVAL '30 days'"))
      .orderBy('due_date');
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const challan = await db('tax_challans').where({ id: req.params.id }).first();
    if (!challan) return res.status(404).json({ error: 'Not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, challan_number, tax_type, period_start, period_end, taxable_amount, tax_amount, penalty, due_date, notes } = req.body;
    if (!wing_id || !tax_type || !period_start || !period_end || !tax_amount) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const [challan] = await db('tax_challans').insert({
      wing_id, challan_number, tax_type, period_start, period_end,
      taxable_amount: taxable_amount || 0, tax_amount, penalty: penalty || 0,
      due_date, notes,
    }).returning('*');
    res.status(201).json(challan);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, paid_date, total_paid, bank_account_id, challan_number, notes } = req.body;
    const [challan] = await db('tax_challans').where({ id: req.params.id })
      .update({ status, paid_date, total_paid, bank_account_id, challan_number, notes, updated_at: new Date() })
      .returning('*');
    if (!challan) return res.status(404).json({ error: 'Not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, challan_type, status } = req.query;
    let q = db('tax_challans')
      .leftJoin('business_wings', 'business_wings.id', 'tax_challans.business_wing_id')
      .select('tax_challans.*', 'business_wings.name as wing_name')
      .orderBy('tax_challans.due_date', 'desc');
    if (wing_id)      q = q.where('tax_challans.business_wing_id', wing_id);
    if (challan_type) q = q.where('tax_challans.challan_type', challan_type);
    if (status)       q = q.where('tax_challans.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const upcoming = await db('tax_challans')
      .whereIn('status', ['Pending', 'Overdue'])
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
    const { wing_id, challan_type, challan_title, period, amount_due, due_date, notes } = req.body;
    if (!wing_id || !challan_type || !challan_title || !amount_due || !due_date) {
      return res.status(400).json({ error: 'wing_id, challan_type, challan_title, amount_due, due_date required' });
    }
    const [challan] = await db('tax_challans').insert({
      business_wing_id: wing_id, challan_type, challan_title,
      period, amount_due, due_date, notes,
    }).returning('*');
    res.status(201).json(challan);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, payment_date, bank_account_id, challan_number, notes } = req.body;
    const [challan] = await db('tax_challans').where({ id: req.params.id })
      .update({ status, payment_date, bank_account_id, challan_number, notes })
      .returning('*');
    if (!challan) return res.status(404).json({ error: 'Not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

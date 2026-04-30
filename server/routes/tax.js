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
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const upcoming = await db('tax_challans')
      .whereIn('status', ['pending', 'overdue'])
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
    const {
      wing_id, challan_number, tax_type,
      period_start, period_end,
      taxable_amount, tax_amount, penalty,
      due_date, notes,
    } = req.body;

    if (!wing_id || !tax_type || !period_start || !period_end || !tax_amount) {
      return res.status(400).json({ error: 'wing_id, tax_type, period_start, period_end, tax_amount are required' });
    }

    const [challan] = await db('tax_challans').insert({
      wing_id,
      challan_number:  challan_number  || null,
      tax_type,
      period_start,
      period_end,
      taxable_amount:  parseFloat(taxable_amount) || 0,
      tax_amount:      parseFloat(tax_amount),
      penalty:         parseFloat(penalty)        || 0,
      due_date:        due_date || null,
      notes:           notes    || null,
      status:          'pending',
    }).returning('*');

    res.status(201).json(challan);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      wing_id, challan_number, tax_type,
      period_start, period_end,
      taxable_amount, tax_amount, penalty,
      due_date, paid_date, notes, status,
      bank_account_id,
    } = req.body;

    const update = {};
    if (wing_id        !== undefined) update.wing_id         = wing_id;
    if (challan_number !== undefined) update.challan_number  = challan_number;
    if (tax_type       !== undefined) update.tax_type        = tax_type;
    if (period_start   !== undefined) update.period_start    = period_start;
    if (period_end     !== undefined) update.period_end      = period_end;
    if (taxable_amount !== undefined) update.taxable_amount  = parseFloat(taxable_amount) || 0;
    if (tax_amount     !== undefined) update.tax_amount      = parseFloat(tax_amount);
    if (penalty        !== undefined) update.penalty         = parseFloat(penalty) || 0;
    if (due_date       !== undefined) update.due_date        = due_date || null;
    if (paid_date      !== undefined) update.paid_date       = paid_date || null;
    if (notes          !== undefined) update.notes           = notes;
    if (status         !== undefined) update.status          = status;
    if (bank_account_id !== undefined) update.bank_account_id = bank_account_id || null;

    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const [challan] = await db('tax_challans').where({ id: req.params.id })
      .update(update).returning('*');
    if (!challan) return res.status(404).json({ error: 'Not found' });
    res.json(challan);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db('tax_challans').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

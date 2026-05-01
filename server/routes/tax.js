const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── helpers ─────────────────────────────────────────────────────────────────
// Frontend sends period_start + period_end; DB stores a single text column.
function buildPeriod(start, end) {
  if (start && end) return `${start} to ${end}`;
  return start || end || null;
}
function splitPeriod(period) {
  if (!period) return { period_start: '', period_end: '' };
  const [s, , e] = period.split(' ');
  return { period_start: s || '', period_end: e || s || '' };
}

// ─── GET / ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, tax_type, status } = req.query;
    let q = db('tax_challans')
      .leftJoin('business_wings', 'business_wings.id', 'tax_challans.business_wing_id')
      .leftJoin('bank_accounts',  'bank_accounts.id',  'tax_challans.bank_account_id')
      .select(
        'tax_challans.id',
        'tax_challans.business_wing_id',
        'tax_challans.challan_number',
        'tax_challans.challan_type',
        'tax_challans.period',
        'tax_challans.amount_due',
        'tax_challans.taxable_amount',
        'tax_challans.penalty',
        'tax_challans.status',
        'tax_challans.due_date',
        'tax_challans.paid_date',
        'tax_challans.bank_account_id',
        'tax_challans.notes',
        'tax_challans.created_at',
        'business_wings.name as wing_name',
        'bank_accounts.bank_name',
        'bank_accounts.account_title',
      )
      .orderBy('tax_challans.due_date', 'desc');
    if (wing_id)  q = q.where('tax_challans.business_wing_id', wing_id);
    if (tax_type) q = q.where('tax_challans.challan_type', tax_type);
    if (status)   q = q.where('tax_challans.status', status);

    const rows = await q;
    res.json(rows.map(r => ({ ...r, ...splitPeriod(r.period) })));
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /upcoming ───────────────────────────────────────────────────────────
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

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const challan = await db('tax_challans').where({ id: req.params.id }).first();
    if (!challan) return res.status(404).json({ error: 'Not found' });
    res.json({ ...challan, ...splitPeriod(challan.period) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST / ──────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      wing_id, challan_number, tax_type,
      period_start, period_end,
      taxable_amount, tax_amount, penalty,
      due_date, notes, bank_account_id,
    } = req.body;

    if (!wing_id || !tax_type || !period_start || !period_end || !tax_amount || !due_date) {
      return res.status(400).json({ error: 'wing_id, tax_type, period_start, period_end, tax_amount, due_date are required' });
    }

    const [challan] = await db('tax_challans').insert({
      business_wing_id: wing_id,
      challan_type:     tax_type,
      challan_title:    tax_type,
      period:           buildPeriod(period_start, period_end),
      challan_number:   challan_number  || null,
      amount_due:       parseFloat(tax_amount),
      taxable_amount:   parseFloat(taxable_amount) || 0,
      penalty:          parseFloat(penalty) || 0,
      due_date:         due_date || null,
      notes:            notes    || null,
      bank_account_id:  bank_account_id || null,
      status:           'pending',
    }).returning('*');

    res.status(201).json({ ...challan, ...splitPeriod(challan.period) });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const {
      wing_id, challan_number, tax_type,
      period_start, period_end,
      taxable_amount, tax_amount, penalty,
      due_date, paid_date, notes, status,
      bank_account_id,
    } = req.body;

    const challan = await db('tax_challans').where({ id: req.params.id }).first();
    if (!challan) return res.status(404).json({ error: 'Not found' });

    const update = {};
    if (wing_id         !== undefined) update.business_wing_id = wing_id;
    if (tax_type        !== undefined) { update.challan_type = tax_type; update.challan_title = tax_type; }
    if (period_start    !== undefined || period_end !== undefined) {
      const s = period_start ?? splitPeriod(challan.period).period_start;
      const e = period_end   ?? splitPeriod(challan.period).period_end;
      update.period = buildPeriod(s, e);
    }
    if (challan_number  !== undefined) update.challan_number  = challan_number || null;
    if (tax_amount      !== undefined) update.amount_due      = parseFloat(tax_amount);
    if (taxable_amount  !== undefined) update.taxable_amount  = parseFloat(taxable_amount) || 0;
    if (penalty         !== undefined) update.penalty         = parseFloat(penalty) || 0;
    if (due_date        !== undefined) update.due_date        = due_date || null;
    if (notes           !== undefined) update.notes           = notes;
    if (status          !== undefined) update.status          = status;
    if (bank_account_id !== undefined) update.bank_account_id = bank_account_id || null;
    if (paid_date       !== undefined) {
      update.paid_date     = paid_date || null;
      update.payment_date  = paid_date || null;
    }

    const payingNow = status === 'paid' && challan.status !== 'paid' && bank_account_id;

    await db.transaction(async (trx) => {
      await trx('tax_challans').where({ id: req.params.id }).update(update);

      if (payingNow) {
        const account = await trx('bank_accounts').where({ id: bank_account_id }).first();
        if (!account) throw new Error('Bank account not found');

        const total = (parseFloat(challan.amount_due) || 0) + (parseFloat(update.penalty ?? challan.penalty) || 0);
        const newBalance = parseFloat(account.current_balance) - total;

        await trx('bank_transactions').insert({
          bank_account_id,
          business_wing_id: challan.business_wing_id,
          txn_type:         'Debit',
          amount:           total,
          currency:         account.currency || 'PKR',
          description:      `Tax Challan — ${tax_type || challan.challan_type}: ${challan.period}`,
          reference_type:   'tax',
          txn_date:         paid_date || new Date().toISOString().split('T')[0],
          running_balance:  newBalance,
        });

        await trx('bank_accounts').where({ id: bank_account_id })
          .update({ current_balance: newBalance });
      }
    });

    const updated = await db('tax_challans').where({ id: req.params.id }).first();
    res.json({ ...updated, ...splitPeriod(updated.period) });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
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

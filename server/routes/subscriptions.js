const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── helpers ─────────────────────────────────────────────────────────────────
function advanceDueDate(dateStr, cycle) {
  const d = new Date(dateStr);
  switch (cycle) {
    case 'Monthly':   d.setMonth(d.getMonth() + 1);        break;
    case 'Quarterly': d.setMonth(d.getMonth() + 3);        break;
    case 'Annual':    d.setFullYear(d.getFullYear() + 1);  break;
    default: return null;
  }
  return d.toISOString().split('T')[0];
}

async function getCC(trx) {
  const t = trx || db;
  const cc = await t('credit_cards').first();
  if (!cc) throw new Error('Credit card record not found. Run supabase_subscriptions_v1.sql first.');
  return cc;
}

// ─── GET / ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, status } = req.query;
    let q = db('subscriptions')
      .leftJoin('business_wings', 'business_wings.id', 'subscriptions.business_wing_id')
      .select(
        'subscriptions.id',
        'subscriptions.business_wing_id',
        'subscriptions.service_name',
        'subscriptions.amount',
        'subscriptions.currency_code',
        'subscriptions.billing_cycle',
        'subscriptions.next_renewal_date',
        'subscriptions.last_paid_date',
        'subscriptions.last_paid_amount',
        'subscriptions.status',
        'subscriptions.notes',
        'subscriptions.vendor_url',
        'subscriptions.credit_card_id',
        'business_wings.name as wing_name',
      )
      .orderBy('subscriptions.next_renewal_date');

    if (wing_id) q = q.where('subscriptions.business_wing_id', wing_id);
    if (status)  q = q.where('subscriptions.status', status);
    else         q = q.whereNot('subscriptions.status', 'cancelled');

    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /upcoming ───────────────────────────────────────────────────────────
router.get('/upcoming', async (req, res) => {
  try {
    const { wing_id } = req.query;
    let q = db('subscriptions')
      .where('status', 'active')
      .where('next_renewal_date', '<=', db.raw("CURRENT_DATE + INTERVAL '30 days'"))
      .orderBy('next_renewal_date');
    if (wing_id) q = q.where('business_wing_id', wing_id);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /cc-balance ─────────────────────────────────────────────────────────
router.get('/cc-balance', async (req, res) => {
  try {
    const cc = await getCC();
    res.json(cc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST / ──────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      business_wing_id, service_name, amount, currency_code,
      billing_cycle, next_renewal_date, notes, vendor_url,
    } = req.body;

    if (!business_wing_id || !service_name || !amount || !next_renewal_date) {
      return res.status(400).json({ error: 'business_wing_id, service_name, amount, next_renewal_date required' });
    }

    const cc = await getCC();

    const [sub] = await db('subscriptions').insert({
      business_wing_id,
      service_name,
      amount:           parseFloat(amount),
      currency_code:    currency_code    || 'PKR',
      exchange_rate:    1,
      pkr_amount:       parseFloat(amount),
      billing_cycle:    billing_cycle    || 'Monthly',
      next_renewal_date,
      status:           'active',
      notes:            notes            || null,
      vendor_url:       vendor_url       || null,
      credit_card_id:   cc.id,
    }).returning('*');

    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const sub = await db('subscriptions').where({ id: req.params.id }).first();
    if (!sub) return res.status(404).json({ error: 'Not found' });

    const {
      business_wing_id, service_name, amount, currency_code,
      billing_cycle, next_renewal_date, status, notes, vendor_url,
    } = req.body;

    const update = {};
    if (business_wing_id  !== undefined) update.business_wing_id  = business_wing_id;
    if (service_name      !== undefined) update.service_name      = service_name;
    if (amount            !== undefined) { update.amount = parseFloat(amount); update.pkr_amount = parseFloat(amount); }
    if (currency_code     !== undefined) update.currency_code     = currency_code;
    if (billing_cycle     !== undefined) update.billing_cycle     = billing_cycle;
    if (next_renewal_date !== undefined) update.next_renewal_date = next_renewal_date;
    if (notes             !== undefined) update.notes             = notes || null;
    if (vendor_url        !== undefined) update.vendor_url        = vendor_url || null;
    if (status            !== undefined) update.status            = status;

    await db('subscriptions').where({ id: req.params.id }).update(update);
    const updated = await db('subscriptions').where({ id: req.params.id }).first();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /:id/pay — pay via credit card ─────────────────────────────────────
router.post('/:id/pay', async (req, res) => {
  try {
    const { paid_amount, paid_date } = req.body;
    if (!paid_amount) return res.status(400).json({ error: 'paid_amount required' });

    const sub = await db('subscriptions').where({ id: req.params.id }).first();
    if (!sub) return res.status(404).json({ error: 'Not found' });

    const amount = parseFloat(paid_amount);
    const date   = paid_date || new Date().toISOString().split('T')[0];

    await db.transaction(async (trx) => {
      const cc = await getCC(trx);
      if (cc.current_balance < amount) throw new Error('Insufficient credit card balance');

      const newCCBalance = parseFloat(cc.current_balance) - amount;

      await trx('credit_cards').where({ id: cc.id }).update({ current_balance: newCCBalance });

      await trx('credit_card_txns').insert({
        credit_card_id:   cc.id,
        txn_date:         date,
        merchant:         sub.service_name,
        notes:            `Subscription — ${sub.billing_cycle}`,
        amount,
        currency:         sub.currency_code || 'PKR',
        category:         'subscriptions',
        business_wing_id: sub.business_wing_id,
        txn_type:         'debit',
        reference_type:   'subscription',
        reference_id:     sub.id,
        status:           'reconciled',
      });

      const nextDate = advanceDueDate(sub.next_renewal_date, sub.billing_cycle);

      await trx('subscriptions').where({ id: sub.id }).update({
        last_paid_date:    date,
        last_paid_amount:  amount,
        next_renewal_date: nextDate || sub.next_renewal_date,
        status:            sub.billing_cycle === 'once' ? 'paused' : 'active',
      });
    });

    const updated = await db('subscriptions').where({ id: req.params.id }).first();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
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

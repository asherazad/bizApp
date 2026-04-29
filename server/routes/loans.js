const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /  — list loans (with resource name + total repaid) ─────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, status } = req.query;

    let q = db('loan_records as l')
      .join('resources as r', 'r.id', 'l.resource_id')
      .leftJoin('business_wings as bw', 'bw.id', 'l.business_wing_id')
      .select(
        'l.*',
        'r.full_name as resource_name',
        'bw.name as wing_name',
        db.raw(`COALESCE(
          (SELECT SUM(rp.amount) FROM loan_repayments rp WHERE rp.loan_id = l.id), 0
        ) as total_repaid`)
      )
      .orderBy('l.issued_date', 'desc');

    if (wing_id)     q = q.where('l.business_wing_id', wing_id);
    if (resource_id) q = q.where('l.resource_id', resource_id);
    if (status)      q = q.where('l.status', status);
    else             q = q.whereIn('l.status', ['active', 'settled', 'written_off']);

    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /  — create new loan or advance ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { resource_id, business_wing_id, loan_type, amount, issued_date, monthly_installment, purpose, notes } = req.body;
    if (!resource_id || !amount) {
      return res.status(400).json({ error: 'resource_id and amount are required' });
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });

    const [loan] = await db('loan_records').insert({
      resource_id,
      business_wing_id: business_wing_id || null,
      loan_type:           loan_type    || 'loan',
      amount:              amt,
      remaining_balance:   amt,
      issued_date:         issued_date  || new Date().toISOString().split('T')[0],
      monthly_installment: parseFloat(monthly_installment) || 0,
      purpose:             purpose      || null,
      notes:               notes        || null,
      status:              'active',
    }).returning('*');

    res.status(201).json(loan);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id  — update installment / notes / status ─────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['monthly_installment', 'purpose', 'notes', 'status'];
    const update  = Object.fromEntries(
      allowed.filter(k => k in req.body).map(k => [k, req.body[k]])
    );
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update' });

    const [loan] = await db('loan_records').where({ id: req.params.id }).update(update).returning('*');
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /:id/repay  — record a repayment, decrement remaining_balance ──────
router.post('/:id/repay', async (req, res) => {
  try {
    const { amount, repayment_date, notes } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });

    const loan = await db('loan_records').where({ id: req.params.id }).first();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status !== 'active') return res.status(400).json({ error: 'Loan is not active' });

    const newBalance = Math.max(0, parseFloat(loan.remaining_balance) - amt);
    const newStatus  = newBalance === 0 ? 'settled' : 'active';

    await db.transaction(async trx => {
      await trx('loan_repayments').insert({
        loan_id:        loan.id,
        amount:         amt,
        repayment_date: repayment_date || new Date().toISOString().split('T')[0],
        notes:          notes || null,
      });
      await trx('loan_records').where({ id: loan.id }).update({
        remaining_balance: newBalance,
        status:            newStatus,
      });
    });

    const updated = await db('loan_records').where({ id: loan.id }).first();
    res.json({ loan: updated, message: newStatus === 'settled' ? 'Loan fully settled!' : `Remaining: PKR ${newBalance.toLocaleString()}` });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /:id/repayments  — repayment history for a loan ─────────────────────
router.get('/:id/repayments', async (req, res) => {
  try {
    const rows = await db('loan_repayments')
      .where({ loan_id: req.params.id })
      .orderBy('repayment_date', 'desc');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id  — delete loan (only if no repayments) ──────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const count = await db('loan_repayments').where({ loan_id: req.params.id }).count('id as n').first();
    if (parseInt(count.n) > 0) {
      return res.status(400).json({ error: 'Cannot delete a loan that has repayments recorded' });
    }
    const n = await db('loan_records').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── Payroll Runs ─────────────────────────────────────────────────────────────

router.get('/runs', async (req, res) => {
  try {
    const { wing_id } = req.query;
    let q = db('payroll_runs')
      .leftJoin('business_wings', 'business_wings.id', 'payroll_runs.wing_id')
      .select('payroll_runs.*', 'business_wings.name as wing_name')
      .orderBy([{ column: 'payroll_runs.period_year', order: 'desc' }, { column: 'payroll_runs.period_month', order: 'desc' }]);
    if (wing_id) q = q.where('payroll_runs.wing_id', wing_id);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/runs/:id', async (req, res) => {
  try {
    const run = await db('payroll_runs').where({ id: req.params.id }).first();
    if (!run) return res.status(404).json({ error: 'Not found' });
    const items = await db('payroll_items')
      .join('resources', 'resources.id', 'payroll_items.resource_id')
      .where('payroll_items.payroll_run_id', req.params.id)
      .select('payroll_items.*', 'resources.name as resource_name');
    res.json({ ...run, items });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/runs', async (req, res) => {
  try {
    const { wing_id, period_month, period_year, bank_account_id } = req.body;
    if (!wing_id || !period_month || !period_year) {
      return res.status(400).json({ error: 'wing_id, period_month, period_year required' });
    }
    const [run] = await db('payroll_runs').insert({ wing_id, period_month, period_year, bank_account_id }).returning('*');
    res.status(201).json(run);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Payroll run already exists for this period' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/runs/:id/items', async (req, res) => {
  try {
    const { resource_id, base_salary, overtime_amount, bonus, loan_deduction, tax_deduction, other_deductions } = req.body;
    const net = (parseFloat(base_salary) || 0)
      + (parseFloat(overtime_amount) || 0)
      + (parseFloat(bonus) || 0)
      - (parseFloat(loan_deduction) || 0)
      - (parseFloat(tax_deduction) || 0)
      - (parseFloat(other_deductions) || 0);

    const [item] = await db('payroll_items').insert({
      payroll_run_id: req.params.id, resource_id,
      base_salary: base_salary || 0, overtime_amount: overtime_amount || 0,
      bonus: bonus || 0, loan_deduction: loan_deduction || 0,
      tax_deduction: tax_deduction || 0, other_deductions: other_deductions || 0,
      net_amount: net,
    }).returning('*');

    // Update run totals
    const items = await db('payroll_items').where({ payroll_run_id: req.params.id });
    const totals = items.reduce((acc, it) => ({
      gross: acc.gross + parseFloat(it.base_salary) + parseFloat(it.overtime_amount) + parseFloat(it.bonus),
      deductions: acc.deductions + parseFloat(it.loan_deduction) + parseFloat(it.tax_deduction) + parseFloat(it.other_deductions),
      net: acc.net + parseFloat(it.net_amount),
    }), { gross: 0, deductions: 0, net: 0 });

    await db('payroll_runs').where({ id: req.params.id }).update({
      total_gross: totals.gross, total_deductions: totals.deductions, total_net: totals.net,
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/runs/:id/finalize', async (req, res) => {
  try {
    const [run] = await db('payroll_runs').where({ id: req.params.id })
      .update({ status: 'finalized', updated_at: new Date() }).returning('*');
    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Loans & Advances ─────────────────────────────────────────────────────────

router.get('/loans', async (req, res) => {
  try {
    const { wing_id, resource_id, status } = req.query;
    let q = db('loans_advances')
      .join('resources', 'resources.id', 'loans_advances.resource_id')
      .select('loans_advances.*', 'resources.name as resource_name')
      .orderBy('loans_advances.issued_date', 'desc');
    if (wing_id)     q = q.where('loans_advances.wing_id', wing_id);
    if (resource_id) q = q.where('loans_advances.resource_id', resource_id);
    if (status)      q = q.where('loans_advances.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/loans', async (req, res) => {
  try {
    const { resource_id, wing_id, loan_type, amount, issued_date, installment_months, purpose } = req.body;
    if (!resource_id || !wing_id || !amount || !issued_date) return res.status(400).json({ error: 'Required fields missing' });
    const [loan] = await db('loans_advances').insert({
      resource_id, wing_id, loan_type: loan_type || 'loan',
      amount, remaining_balance: amount, issued_date, installment_months, purpose,
    }).returning('*');
    res.status(201).json(loan);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/loans/:id/repayments', async (req, res) => {
  try {
    const { amount, repayment_date, payroll_item_id, notes } = req.body;
    const loan = await db('loans_advances').where({ id: req.params.id }).first();
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const newBalance = Math.max(0, parseFloat(loan.remaining_balance) - parseFloat(amount));
    const newStatus  = newBalance === 0 ? 'settled' : 'active';

    const rep = await db.transaction(async (trx) => {
      const [r] = await trx('loan_repayments').insert({
        loan_id: req.params.id, payroll_item_id, amount, repayment_date, notes,
      }).returning('*');
      await trx('loans_advances').where({ id: req.params.id })
        .update({ remaining_balance: newBalance, status: newStatus });
      return r;
    });
    res.status(201).json(rep);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

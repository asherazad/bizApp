const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, month_year, status } = req.query;
    let q = db('payroll_runs')
      .join('resources', 'resources.id', 'payroll_runs.resource_id')
      .leftJoin('business_wings', 'business_wings.id', 'payroll_runs.business_wing_id')
      .select('payroll_runs.*', 'resources.full_name as resource_name', 'business_wings.name as wing_name')
      .orderBy('payroll_runs.month_year', 'desc');
    if (wing_id)     q = q.where('payroll_runs.business_wing_id', wing_id);
    if (resource_id) q = q.where('payroll_runs.resource_id', resource_id);
    if (month_year)  q = q.where('payroll_runs.month_year', month_year);
    if (status)      q = q.where('payroll_runs.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const run = await db('payroll_runs')
      .join('resources', 'resources.id', 'payroll_runs.resource_id')
      .where('payroll_runs.id', req.params.id)
      .select('payroll_runs.*', 'resources.full_name as resource_name')
      .first();
    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      wing_id, resource_id, month_year, working_days, present_days,
      basic_earned, allowances_earned, overtime_hours, overtime_rate, overtime_amount,
      loan_deduction, advance_deduction, tax_deduction, other_deductions,
      payment_date, bank_account_id,
    } = req.body;

    if (!wing_id || !resource_id || !month_year || !working_days || present_days === undefined) {
      return res.status(400).json({ error: 'wing_id, resource_id, month_year, working_days, present_days required' });
    }

    const net = (parseFloat(basic_earned) || 0)
      + (parseFloat(allowances_earned) || 0)
      + (parseFloat(overtime_amount) || 0)
      - (parseFloat(loan_deduction) || 0)
      - (parseFloat(advance_deduction) || 0)
      - (parseFloat(tax_deduction) || 0)
      - (parseFloat(other_deductions) || 0);

    const [run] = await db('payroll_runs').insert({
      business_wing_id: wing_id, resource_id, month_year,
      working_days, present_days,
      basic_earned:      basic_earned      || 0,
      allowances_earned: allowances_earned || 0,
      overtime_hours:    overtime_hours    || 0,
      overtime_rate:     overtime_rate     || 0,
      overtime_amount:   overtime_amount   || 0,
      loan_deduction:    loan_deduction    || 0,
      advance_deduction: advance_deduction || 0,
      tax_deduction:     tax_deduction     || 0,
      other_deductions:  other_deductions  || 0,
      net_salary: net,
      payment_date, bank_account_id,
    }).returning('*');

    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, payment_date, bank_account_id } = req.body;
    const [run] = await db('payroll_runs').where({ id: req.params.id })
      .update({ status, payment_date, bank_account_id })
      .returning('*');
    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

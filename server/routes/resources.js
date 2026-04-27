const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_type, status, search } = req.query;
    let q = db('resources')
      .leftJoin('business_wings', 'business_wings.id', 'resources.business_wing_id')
      .select('resources.*', 'business_wings.name as wing_name')
      .orderBy('resources.full_name');
    if (wing_id)       q = q.where('resources.business_wing_id', wing_id);
    if (resource_type) q = q.where('resources.resource_type', resource_type);
    if (status)        q = q.where('resources.status', status);
    if (search)        q = q.whereRaw('resources.full_name ILIKE ?', [`%${search}%`]);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const resource = await db('resources')
      .leftJoin('business_wings', 'business_wings.id', 'resources.business_wing_id')
      .where('resources.id', req.params.id)
      .select('resources.*', 'business_wings.name as wing_name')
      .first();
    if (!resource) return res.status(404).json({ error: 'Not found' });

    const loans = await db('loan_records')
      .where({ resource_id: req.params.id })
      .orderBy('created_at', 'desc');

    res.json({ ...resource, loans });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      wing_id, full_name, cnic, resource_type, designation, department,
      join_date, end_date, contract_type, basic_salary, allowances,
      annual_leaves, status,
    } = req.body;
    if (!wing_id || !full_name || !resource_type || !join_date) {
      return res.status(400).json({ error: 'wing_id, full_name, resource_type, join_date required' });
    }
    const [resource] = await db('resources').insert({
      business_wing_id: wing_id, full_name, cnic,
      resource_type, designation, department,
      join_date, end_date, contract_type,
      basic_salary: basic_salary || 0,
      allowances: allowances || { house: 0, medical: 0, transport: 0, other: 0 },
      annual_leaves: annual_leaves || 18,
      status: status || 'Active',
    }).returning('*');
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { full_name, cnic, designation, department, end_date, contract_type, basic_salary, allowances, annual_leaves, status } = req.body;
    const [resource] = await db('resources').where({ id: req.params.id })
      .update({ full_name, cnic, designation, department, end_date, contract_type, basic_salary, allowances, annual_leaves, status })
      .returning('*');
    if (!resource) return res.status(404).json({ error: 'Not found' });
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Loans & Advances ─────────────────────────────────────────────────────────

router.get('/:id/loans', async (req, res) => {
  try {
    const loans = await db('loan_records')
      .where({ resource_id: req.params.id })
      .orderBy('created_at', 'desc');
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/loans', async (req, res) => {
  try {
    const { loan_type, amount, installments, monthly_installment, start_month, notes } = req.body;
    if (!loan_type || !amount || !installments || !monthly_installment || !start_month) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const [loan] = await db('loan_records').insert({
      resource_id: req.params.id,
      loan_type, amount, installments,
      monthly_installment, start_month, notes,
    }).returning('*');
    res.status(201).json(loan);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/loans/:id', async (req, res) => {
  try {
    const { amount_recovered, status, notes } = req.body;
    const [loan] = await db('loan_records').where({ id: req.params.id })
      .update({ amount_recovered, status, notes })
      .returning('*');
    if (!loan) return res.status(404).json({ error: 'Not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

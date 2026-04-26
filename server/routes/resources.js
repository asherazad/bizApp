const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, type, search } = req.query;
    let q = db('resources').orderBy('name');
    if (type)   q = q.where('type', type);
    if (search) q = q.whereRaw('name ILIKE ?', [`%${search}%`]);
    if (wing_id) {
      q = db('resources')
        .join('resource_wings', 'resource_wings.resource_id', 'resources.id')
        .where('resource_wings.wing_id', wing_id)
        .select('resources.*', 'resource_wings.designation', 'resource_wings.department')
        .orderBy('resources.name');
      if (type)   q = q.where('resources.type', type);
      if (search) q = q.whereRaw('resources.name ILIKE ?', [`%${search}%`]);
    }
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const resource = await db('resources').where({ id: req.params.id }).first();
    if (!resource) return res.status(404).json({ error: 'Not found' });
    const wings = await db('resource_wings')
      .join('business_wings', 'business_wings.id', 'resource_wings.wing_id')
      .where('resource_wings.resource_id', req.params.id)
      .select('resource_wings.*', 'business_wings.name as wing_name');
    const contracts = await db('contracts').where({ resource_id: req.params.id }).orderBy('start_date', 'desc');
    res.json({ ...resource, wings, contracts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, cnic, email, phone, address, date_of_birth, emergency_contact } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const [resource] = await db('resources').insert({
      name, type: type || 'employee', cnic, email, phone, address, date_of_birth, emergency_contact,
    }).returning('*');
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, cnic, email, phone, address, emergency_contact, is_active } = req.body;
    const [resource] = await db('resources').where({ id: req.params.id })
      .update({ name, cnic, email, phone, address, emergency_contact, is_active, updated_at: new Date() })
      .returning('*');
    if (!resource) return res.status(404).json({ error: 'Not found' });
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign resource to wing
router.post('/:id/wings', async (req, res) => {
  try {
    const { wing_id, designation, department, start_date, is_primary } = req.body;
    if (!wing_id || !start_date) return res.status(400).json({ error: 'wing_id and start_date required' });
    const [rw] = await db('resource_wings').insert({
      resource_id: req.params.id, wing_id, designation, department, start_date, is_primary: !!is_primary,
    }).returning('*');
    res.status(201).json(rw);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Contracts
router.post('/:id/contracts', async (req, res) => {
  try {
    const { wing_id, contract_type, start_date, end_date, salary, currency_code, exchange_rate, notes } = req.body;
    if (!wing_id || !start_date || !salary) return res.status(400).json({ error: 'Required fields missing' });
    const rate = parseFloat(exchange_rate) || 1;
    const pkr  = (currency_code === 'PKR') ? salary : salary * rate;
    const [contract] = await db('contracts').insert({
      resource_id: req.params.id, wing_id,
      contract_type: contract_type || 'permanent',
      start_date, end_date, salary, currency_code: currency_code || 'PKR',
      exchange_rate: rate, pkr_salary: pkr, notes,
    }).returning('*');
    res.status(201).json(contract);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

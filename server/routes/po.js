const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, client_id, status } = req.query;
    let q = db('purchase_orders')
      .leftJoin('clients', 'clients.id', 'purchase_orders.client_id')
      .leftJoin('business_wings', 'business_wings.id', 'purchase_orders.business_wing_id')
      .select('purchase_orders.*', 'clients.name as client_name', 'business_wings.name as wing_name')
      .orderBy('purchase_orders.issue_date', 'desc');
    if (wing_id)   q = q.where('purchase_orders.business_wing_id', wing_id);
    if (client_id) q = q.where('purchase_orders.client_id', client_id);
    if (status)    q = q.where('purchase_orders.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const po = await db('purchase_orders')
      .leftJoin('clients', 'clients.id', 'purchase_orders.client_id')
      .leftJoin('business_wings', 'business_wings.id', 'purchase_orders.business_wing_id')
      .where('purchase_orders.id', req.params.id)
      .select('purchase_orders.*', 'clients.name as client_name', 'business_wings.name as wing_name')
      .first();
    if (!po) return res.status(404).json({ error: 'PO not found' });

    const invoices = await db('invoices')
      .where({ po_id: po.id })
      .select('id', 'invoice_number', 'status', 'total_amount', 'invoice_date');

    const invoiced = invoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    res.json({ ...po, invoices, invoiced_amount: invoiced, remaining: parseFloat(po.po_value) - invoiced });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, client_id, po_number, currency, exchange_rate, po_value, issue_date, expiry_date, notes } = req.body;
    if (!wing_id || !po_number || !issue_date || !po_value) {
      return res.status(400).json({ error: 'wing_id, po_number, issue_date, po_value required' });
    }
    const rate = parseFloat(exchange_rate) || 1;
    const val  = parseFloat(po_value);
    const pkr  = (currency === 'PKR' || !currency) ? val : val * rate;

    const [po] = await db('purchase_orders').insert({
      business_wing_id: wing_id, client_id, po_number,
      currency: currency || 'PKR', exchange_rate: rate,
      po_value: val, pkr_equivalent: pkr,
      issue_date, expiry_date, notes,
    }).returning('*');

    res.status(201).json(po);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'PO number already exists' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, expiry_date, notes } = req.body;
    const [po] = await db('purchase_orders').where({ id: req.params.id })
      .update({ status, expiry_date, notes })
      .returning('*');
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json(po);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

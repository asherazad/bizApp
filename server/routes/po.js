const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, vendor_id, status } = req.query;
    let q = db('purchase_orders')
      .leftJoin('clients', 'clients.id', 'purchase_orders.vendor_id')
      .leftJoin('business_wings', 'business_wings.id', 'purchase_orders.wing_id')
      .select('purchase_orders.*', 'clients.name as vendor_name', 'business_wings.name as wing_name')
      .orderBy('purchase_orders.order_date', 'desc');
    if (wing_id)   q = q.where('purchase_orders.wing_id', wing_id);
    if (vendor_id) q = q.where('purchase_orders.vendor_id', vendor_id);
    if (status)    q = q.where('purchase_orders.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const po = await db('purchase_orders')
      .leftJoin('clients', 'clients.id', 'purchase_orders.vendor_id')
      .leftJoin('business_wings', 'business_wings.id', 'purchase_orders.wing_id')
      .where('purchase_orders.id', req.params.id)
      .select('purchase_orders.*', 'clients.name as vendor_name', 'business_wings.name as wing_name')
      .first();
    if (!po) return res.status(404).json({ error: 'PO not found' });

    const items = await db('po_items').where({ po_id: po.id }).orderBy('sort_order');
    const invoices = await db('invoices')
      .where({ po_id: po.id })
      .select('id', 'invoice_number', 'status', 'total_amount', 'invoice_date');

    const invoiced = invoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    res.json({ ...po, items, invoices, invoiced_amount: invoiced, remaining: parseFloat(po.total_amount) - invoiced });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, vendor_id, po_title, po_number, currency_code, exchange_rate, total_amount, order_date, expected_date, notes, items } = req.body;
    if (!wing_id || !po_number || !order_date || !total_amount) {
      return res.status(400).json({ error: 'wing_id, po_number, order_date, total_amount required' });
    }
    const rate  = parseFloat(exchange_rate) || 1;
    const total = parseFloat(total_amount);
    const pkr   = (currency_code === 'PKR' || !currency_code) ? total : total * rate;

    const [po] = await db('purchase_orders').insert({
      wing_id,
      vendor_id:     vendor_id || null,
      po_title:      po_title  || null,
      po_number,
      currency_code: currency_code || 'PKR',
      exchange_rate: rate,
      total_amount:  total,
      pkr_total:     pkr,
      order_date,
      expected_date: expected_date || null,
      notes,
    }).returning('*');

    if (items?.length) {
      await db('po_items').insert(
        items.map((it, idx) => ({
          po_id:       po.id,
          description: it.description || '',
          quantity:    parseFloat(it.quantity)   || 1,
          unit_price:  parseFloat(it.unit_price) || 0,
          amount:      parseFloat(it.amount)     || 0,
          sort_order:  idx,
        }))
      );
    }

    res.status(201).json(po);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'PO number already exists' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { po_title, po_number, status, vendor_id, currency_code, exchange_rate, total_amount, order_date, expected_date, notes } = req.body;
    const updates = {};
    if (po_title      !== undefined) updates.po_title      = po_title;
    if (po_number     !== undefined) updates.po_number     = po_number;
    if (status        !== undefined) updates.status        = status;
    if (vendor_id     !== undefined) updates.vendor_id     = vendor_id || null;
    if (currency_code !== undefined) updates.currency_code = currency_code;
    if (order_date    !== undefined) updates.order_date    = order_date;
    if (expected_date !== undefined) updates.expected_date = expected_date || null;
    if (notes         !== undefined) updates.notes         = notes;
    if (total_amount  !== undefined) {
      const rate  = parseFloat(exchange_rate) || 1;
      const total = parseFloat(total_amount);
      updates.total_amount  = total;
      updates.exchange_rate = rate;
      updates.pkr_total     = (currency_code === 'PKR' || !currency_code) ? total : total * rate;
    }

    const [po] = await db('purchase_orders').where({ id: req.params.id }).update(updates).returning('*');
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json(po);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'PO number already exists' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

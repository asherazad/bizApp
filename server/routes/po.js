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
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const po = await db('purchase_orders')
      .leftJoin('clients', 'clients.id', 'purchase_orders.vendor_id')
      .where('purchase_orders.id', req.params.id)
      .select('purchase_orders.*', 'clients.name as vendor_name')
      .first();
    if (!po) return res.status(404).json({ error: 'PO not found' });
    const items = await db('po_items').where({ po_id: req.params.id }).orderBy('sort_order');
    const invoices = await db('invoices').where({ po_id: req.params.id }).select('id','invoice_number','status','total','paid_amount');
    res.json({ ...po, items, invoices, remaining: po.total_amount - po.invoiced_amount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wing_id, vendor_id, po_number, currency_code, exchange_rate, order_date, expected_date, notes, items = [] } = req.body;
    if (!wing_id || !po_number || !order_date) {
      return res.status(400).json({ error: 'wing_id, po_number, order_date required' });
    }
    const rate  = parseFloat(exchange_rate) || 1;
    const total = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const pkr   = (currency_code === 'PKR') ? total : total * rate;

    const po = await db.transaction(async (trx) => {
      const [p] = await trx('purchase_orders').insert({
        wing_id, vendor_id, po_number,
        currency_code: currency_code || 'PKR', exchange_rate: rate,
        total_amount: total, pkr_total: pkr,
        order_date, expected_date, notes,
      }).returning('*');
      if (items.length) {
        await trx('po_items').insert(
          items.map((it, i) => ({ po_id: p.id, description: it.description, quantity: it.quantity || 1, unit_price: it.unit_price, amount: it.amount, sort_order: i }))
        );
      }
      return p;
    });

    res.status(201).json(po);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'PO number already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, expected_date, notes } = req.body;
    const [po] = await db('purchase_orders').where({ id: req.params.id })
      .update({ status, expected_date, notes, updated_at: new Date() }).returning('*');
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json(po);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

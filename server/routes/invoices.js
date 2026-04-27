const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id, status, from, to } = req.query;
    let q = db('invoices')
      .leftJoin('business_wings', 'business_wings.id', 'invoices.business_wing_id')
      .leftJoin('purchase_orders', 'purchase_orders.id', 'invoices.po_id')
      .select('invoices.*', 'business_wings.name as wing_name', 'purchase_orders.po_number')
      .orderBy('invoices.invoice_date', 'desc');
    if (wing_id) q = q.where('invoices.business_wing_id', wing_id);
    if (status)  q = q.where('invoices.status', status);
    if (from)    q = q.where('invoices.invoice_date', '>=', from);
    if (to)      q = q.where('invoices.invoice_date', '<=', to);
    res.json(await q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await db('invoices')
      .leftJoin('business_wings', 'business_wings.id', 'invoices.business_wing_id')
      .leftJoin('purchase_orders', 'purchase_orders.id', 'invoices.po_id')
      .leftJoin('bank_accounts', 'bank_accounts.id', 'invoices.received_bank_account_id')
      .where('invoices.id', req.params.id)
      .select(
        'invoices.*',
        'business_wings.name as wing_name',
        'purchase_orders.po_number',
        'bank_accounts.bank_name as received_bank_name',
      )
      .first();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      wing_id, po_id, invoice_number, vendor_name, client_name,
      invoice_date, due_date, currency, exchange_rate,
      total_amount, tax_amount, line_items = [], notes,
    } = req.body;

    if (!wing_id || !invoice_number || !invoice_date || !total_amount) {
      return res.status(400).json({ error: 'wing_id, invoice_number, invoice_date, total_amount required' });
    }

    const rate   = parseFloat(exchange_rate) || 1;
    const total  = parseFloat(total_amount);
    const taxAmt = parseFloat(tax_amount) || 0;
    const pkr    = (currency === 'PKR' || !currency) ? total : total * rate;

    const [invoice] = await db('invoices').insert({
      business_wing_id: wing_id,
      po_id: po_id || null,
      invoice_number, vendor_name, client_name,
      invoice_date, due_date,
      currency: currency || 'PKR',
      exchange_rate: rate,
      total_amount: total,
      tax_amount: taxAmt,
      pkr_equivalent: pkr,
      line_items: JSON.stringify(line_items),
      notes,
    }).returning('*');

    res.status(201).json(invoice);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Invoice number already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, due_date, notes, received_date, received_bank_account_id } = req.body;
    const updates = {};
    if (status !== undefined)                    updates.status = status;
    if (due_date !== undefined)                  updates.due_date = due_date;
    if (notes !== undefined)                     updates.notes = notes;
    if (received_date !== undefined)             updates.received_date = received_date;
    if (received_bank_account_id !== undefined)  updates.received_bank_account_id = received_bank_account_id || null;

    const [inv] = await db('invoices').where({ id: req.params.id })
      .update(updates).returning('*');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// Mark invoice as received (payment recorded)
router.post('/:id/receive', async (req, res) => {
  try {
    const { received_date, received_bank_account_id, notes } = req.body;
    if (!received_date) return res.status(400).json({ error: 'received_date required' });

    const [inv] = await db('invoices').where({ id: req.params.id })
      .update({
        status: 'Received',
        received_date,
        received_bank_account_id: received_bank_account_id || null,
        notes: notes || db.raw('notes'),
      }).returning('*');

    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

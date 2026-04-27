const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── Invoices ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { wing_id, client_id, status, from, to } = req.query;
    let q = db('invoices')
      .leftJoin('clients', 'clients.id', 'invoices.client_id')
      .leftJoin('business_wings', 'business_wings.id', 'invoices.wing_id')
      .select('invoices.*', 'clients.name as client_name', 'business_wings.name as wing_name')
      .orderBy('invoices.issue_date', 'desc');
    if (wing_id)   q = q.where('invoices.wing_id', wing_id);
    if (client_id) q = q.where('invoices.client_id', client_id);
    if (status)    q = q.where('invoices.status', status);
    if (from)      q = q.where('invoices.issue_date', '>=', from);
    if (to)        q = q.where('invoices.issue_date', '<=', to);
    res.json(await q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await db('invoices')
      .leftJoin('clients', 'clients.id', 'invoices.client_id')
      .where('invoices.id', req.params.id)
      .select('invoices.*', 'clients.name as client_name')
      .first();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const items = await db('invoice_items').where({ invoice_id: req.params.id }).orderBy('sort_order');
    const payments = await db('invoice_payments')
      .leftJoin('bank_accounts', 'bank_accounts.id', 'invoice_payments.bank_account_id')
      .where('invoice_payments.invoice_id', req.params.id)
      .select('invoice_payments.*', 'bank_accounts.bank_name');

    res.json({ ...invoice, items, payments });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      wing_id, client_id, po_id, invoice_number, currency_code,
      exchange_rate, tax_rate, issue_date, due_date, notes, items = [],
    } = req.body;
    if (!wing_id || !invoice_number || !issue_date) {
      return res.status(400).json({ error: 'wing_id, invoice_number, issue_date required' });
    }

    const rate   = parseFloat(exchange_rate) || 1;
    const taxPct = parseFloat(tax_rate) || 0;
    const subtotal = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const taxAmt   = subtotal * (taxPct / 100);
    const total    = subtotal + taxAmt;
    const pkrTotal = (currency_code === 'PKR') ? total : total * rate;

    const invoice = await db.transaction(async (trx) => {
      const [inv] = await trx('invoices').insert({
        wing_id, client_id, po_id, invoice_number,
        currency_code: currency_code || 'PKR',
        exchange_rate: rate, tax_rate: taxPct,
        subtotal, tax_amount: taxAmt, total, pkr_total: pkrTotal,
        issue_date, due_date, notes,
      }).returning('*');

      if (items.length) {
        await trx('invoice_items').insert(
          items.map((it, i) => ({
            invoice_id:  inv.id,
            description: it.description,
            notes:       it.notes || null,
            quantity:    it.quantity   || 1,
            unit_price:  it.unit_price || 0,
            amount:      it.amount     || 0,
            sort_order:  i,
          }))
        );
      }
      return inv;
    });

    res.status(201).json(invoice);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Invoice number already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, due_date, notes } = req.body;
    const [inv] = await db('invoices').where({ id: req.params.id })
      .update({ status, due_date, notes, updated_at: new Date() }).returning('*');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Payments ─────────────────────────────────────────────────────────────────

router.post('/:id/payments', async (req, res) => {
  try {
    const { bank_account_id, amount, currency_code, exchange_rate, paid_date, reference, notes } = req.body;
    const invoice = await db('invoices').where({ id: req.params.id }).first();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const amt  = parseFloat(amount);
    const rate = parseFloat(exchange_rate) || 1;
    const pkr  = (currency_code === 'PKR') ? amt : amt * rate;
    const newPaid = parseFloat(invoice.paid_amount) + amt;
    const newStatus = newPaid >= parseFloat(invoice.total) ? 'fully_paid'
      : newPaid > 0 ? 'partially_paid' : invoice.status;

    const payment = await db.transaction(async (trx) => {
      const [pmt] = await trx('invoice_payments').insert({
        invoice_id: req.params.id, bank_account_id, amount: amt,
        currency_code: currency_code || 'PKR', exchange_rate: rate, pkr_amount: pkr,
        paid_date, reference, notes,
      }).returning('*');
      await trx('invoices').where({ id: req.params.id })
        .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date() });
      if (bank_account_id) {
        await trx('bank_accounts').where({ id: bank_account_id })
          .increment('current_balance', amt);
      }
      return pmt;
    });

    res.status(201).json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

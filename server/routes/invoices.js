const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── Server-side text parser ──────────────────────────────────────────────────
function parseInvoiceText(text) {
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  function get(patterns) {
    for (const re of patterns) { const m = text.match(re); if (m) return m[1]?.trim() || ''; }
    return '';
  }
  function parseDate(str) {
    if (!str) return '';
    const m1 = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (m1) { const mo = months[m1[2].slice(0,3).toLowerCase()]; if (mo) return `${m1[3]}-${String(mo).padStart(2,'0')}-${m1[1].padStart(2,'0')}`; }
    const m2 = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    return '';
  }
  function cleanNum(s) { return parseFloat(String(s||'').replace(/,/g,''))||0; }

  const invoice_number = get([/invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i, /\binv[oice]*\s*#?\s*[:\-]?\s*([0-9]+)/i]);
  const invoice_date   = parseDate(get([/(?:invoice\s+)?date\s*[:\-]\s*([^\n\r]+)/i, /dated?\s*[:\-]\s*([^\n\r]+)/i]));
  const due_date       = parseDate(get([/due\s+date\s*[:\-]\s*([^\n\r]+)/i, /payment\s+due\s*[:\-]\s*([^\n\r]+)/i]));
  const vendor_name    = get([/(?:from|issued\s+by|billed\s+by)\s*[:\-]\s*([^\n\r]+)/i]);
  const client_name    = get([/bill(?:ed)?\s+to\s*[:\-]?\s*([^\n\r]+)/i, /(?:to|attn\.?)\s*[:\-]\s*([^\n\r]+)/i]);
  const po_number_ref  = get([/(?:po|purchase\s*order)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9\-]+)/i]);
  const currMatch      = text.match(/\b(USD|EUR|GBP|AED|PKR)\b/);
  const currency       = currMatch ? currMatch[1] : 'PKR';
  const taxMatch       = text.match(/(?:tax|gst|vat)\s*[^\d\n]{0,20}([\d,]+(?:\.\d{1,2})?)/i);
  const tax_amount     = taxMatch ? String(cleanNum(taxMatch[1])) : '0';
  const ntnMatch       = text.match(/ntn\s*[:\-]?\s*([\d\-]+)/i);
  const notes          = ntnMatch ? `NTN: ${ntnMatch[1]}` : '';
  return { invoice_number, invoice_date, due_date, vendor_name, client_name, po_number_ref, currency, tax_amount, notes, line_items: [] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function primaryWing(mode, wingId, splits, lineItems) {
  if (mode === 'single') return wingId;
  if (mode === 'split' && splits && splits.length)
    return splits.reduce((a, b) => parseFloat(b.split_percentage||0) > parseFloat(a.split_percentage||0) ? b : a).business_wing_id;
  if (mode === 'line_item' && lineItems && lineItems.length) {
    const totals = {};
    for (const item of lineItems) {
      if (!item.business_wing_id) continue;
      totals[item.business_wing_id] = (totals[item.business_wing_id]||0) + parseFloat(item.amount||0);
    }
    const top = Object.entries(totals).sort((a,b) => b[1]-a[1])[0];
    return top ? top[0] : wingId;
  }
  return wingId;
}

function splitsFromLineItems(lineItems, total, currency, exchRate) {
  const totals = {};
  for (const item of lineItems) {
    if (!item.business_wing_id) continue;
    totals[item.business_wing_id] = (totals[item.business_wing_id]||0) + parseFloat(item.amount||0);
  }
  return Object.entries(totals).map(([wid, amt]) => ({
    business_wing_id: wid,
    split_amount: amt,
    split_percentage: total > 0 ? parseFloat((amt/total*100).toFixed(4)) : 0,
    pkr_equivalent: currency === 'PKR' ? amt : amt * exchRate,
  }));
}

// ─── POST /parse ──────────────────────────────────────────────────────────────
router.post('/parse', async (req, res) => {
  try {
    const { raw_text } = req.body;
    if (!raw_text) return res.status(400).json({ error: 'raw_text required' });
    res.json(parseInvoiceText(raw_text));
  } catch (err) {
    res.status(500).json({ error: 'Parse error', detail: err.message });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, status, date_from, date_to, po_id, currency } = req.query;
    let q = db('invoices')
      .leftJoin('business_wings', 'business_wings.id', 'invoices.business_wing_id')
      .leftJoin('purchase_orders', 'purchase_orders.id', 'invoices.po_id')
      .select('invoices.*', 'business_wings.name as wing_name', 'purchase_orders.po_number')
      .orderBy('invoices.invoice_date', 'desc');

    if (req.user.role !== 'admin') {
      const wingIds = await db('wing_access_grants').where('user_id', req.user.id).pluck('business_wing_id');
      q = q.whereIn('invoices.business_wing_id', wingIds);
    }
    if (wing_id)   q = q.where('invoices.business_wing_id', wing_id);
    if (status)    q = q.where('invoices.status', status);
    if (date_from) q = q.where('invoices.invoice_date', '>=', date_from);
    if (date_to)   q = q.where('invoices.invoice_date', '<=', date_to);
    if (po_id)     q = q.where('invoices.po_id', po_id);
    if (currency)  q = q.where('invoices.currency', currency);

    const invoices = await q;
    const multiIds = invoices.filter(i => i.wing_assignment_mode && i.wing_assignment_mode !== 'single').map(i => i.id);
    let splitsMap = {};
    if (multiIds.length) {
      const splits = await db('invoice_wing_splits')
        .join('business_wings', 'business_wings.id', 'invoice_wing_splits.business_wing_id')
        .whereIn('invoice_wing_splits.invoice_id', multiIds)
        .select('invoice_wing_splits.*', 'business_wings.name as wing_name');
      for (const s of splits) {
        if (!splitsMap[s.invoice_id]) splitsMap[s.invoice_id] = [];
        splitsMap[s.invoice_id].push(s);
      }
    }
    res.json(invoices.map(inv => ({ ...inv, wing_splits: splitsMap[inv.id] || [] })));
  } catch (err) {
    console.error('GET /invoices', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const inv = await db('invoices')
      .leftJoin('business_wings', 'business_wings.id', 'invoices.business_wing_id')
      .leftJoin('purchase_orders', 'purchase_orders.id', 'invoices.po_id')
      .leftJoin('bank_accounts as rb', 'rb.id', 'invoices.received_bank_account_id')
      .select(
        'invoices.*', 'business_wings.name as wing_name',
        'purchase_orders.po_number', 'purchase_orders.po_value', 'purchase_orders.currency as po_currency',
        'rb.bank_name as received_bank_name', 'rb.account_title as received_account_title',
      )
      .where('invoices.id', req.params.id).first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const wing_splits = await db('invoice_wing_splits')
      .join('business_wings', 'business_wings.id', 'invoice_wing_splits.business_wing_id')
      .where('invoice_wing_splits.invoice_id', inv.id)
      .select('invoice_wing_splits.*', 'business_wings.name as wing_name');

    let po_already_invoiced = 0, po_remaining = null;
    if (inv.po_id) {
      const row = await db('invoices').where('po_id', inv.po_id)
        .whereNot('id', inv.id).sum('total_amount as s').first();
      po_already_invoiced = parseFloat(row && row.s ? row.s : 0);
      po_remaining = parseFloat(inv.po_value||0) - po_already_invoiced - parseFloat(inv.total_amount||0);
    }

    res.json({ ...inv, wing_splits, po_already_invoiced, po_remaining });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      wing_assignment_mode = 'single',
      wing_id, wing_splits = [],
      invoice_number, vendor_name, client_name,
      invoice_date, due_date, currency = 'PKR', exchange_rate,
      total_amount, tax_amount, line_items = [], po_id, notes,
    } = req.body;

    if (!invoice_number || !invoice_date)
      return res.status(400).json({ error: 'invoice_number and invoice_date are required' });

    const exchRate = parseFloat(exchange_rate) || 1;
    const total    = parseFloat(total_amount) || 0;
    const pkr_eq   = currency === 'PKR' ? total : total * exchRate;

    if (wing_assignment_mode === 'single' && !wing_id)
      return res.status(400).json({ error: 'wing_id required for single mode' });
    if (wing_assignment_mode === 'split') {
      if (!wing_splits.length) return res.status(400).json({ error: 'wing_splits required' });
      const sumPct = wing_splits.reduce((s, w) => s + parseFloat(w.split_percentage||0), 0);
      if (Math.abs(sumPct - 100) > 0.05)
        return res.status(400).json({ error: `Split percentages must sum to 100% (got ${sumPct.toFixed(2)}%)` });
    }
    if (wing_assignment_mode === 'line_item') {
      const unassigned = line_items.filter(i => parseFloat(i.amount||0) > 0 && !i.business_wing_id);
      if (unassigned.length)
        return res.status(400).json({ error: `${unassigned.length} line item(s) missing wing assignment` });
    }

    const primary = primaryWing(wing_assignment_mode, wing_id, wing_splits, line_items);

    const invoice = await db.transaction(async (trx) => {
      const [inv] = await trx('invoices').insert({
        business_wing_id: primary, wing_assignment_mode,
        po_id: po_id || null, invoice_number, vendor_name, client_name,
        invoice_date, due_date: due_date || null, currency, exchange_rate: exchRate,
        total_amount: total, tax_amount: parseFloat(tax_amount)||0, pkr_equivalent: pkr_eq,
        line_items: JSON.stringify(line_items), notes: notes || null, status: 'Pending',
      }).returning('*');

      if (wing_assignment_mode === 'split' && wing_splits.length) {
        await trx('invoice_wing_splits').insert(wing_splits.map(w => ({
          invoice_id: inv.id, business_wing_id: w.business_wing_id,
          split_percentage: parseFloat(w.split_percentage), split_amount: parseFloat(w.split_amount),
          pkr_equivalent: currency === 'PKR' ? parseFloat(w.split_amount) : parseFloat(w.split_amount) * exchRate,
        })));
      }
      if (wing_assignment_mode === 'line_item') {
        const splits = splitsFromLineItems(line_items, total, currency, exchRate);
        if (splits.length) await trx('invoice_wing_splits').insert(splits.map(s => ({ invoice_id: inv.id, ...s })));
      }
      return inv;
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error('POST /invoices', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Duplicate invoice number for this vendor' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['status','notes','vendor_name','client_name','due_date'];
    const update  = Object.fromEntries(allowed.filter(k => k in req.body).map(k => [k, req.body[k]]));
    const [inv] = await db('invoices').where({ id: req.params.id }).update(update).returning('*');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PATCH /:id/wing-assignment ───────────────────────────────────────────────
router.patch('/:id/wing-assignment', async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id }).first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'Received')
      return res.status(409).json({ error: 'Wing assignment cannot be changed after payment is recorded.' });

    const { wing_assignment_mode, wing_id, wing_splits = [], line_items } = req.body;
    const total    = parseFloat(inv.total_amount);
    const exchRate = parseFloat(inv.exchange_rate) || 1;
    const items    = line_items || (typeof inv.line_items === 'string' ? JSON.parse(inv.line_items||'[]') : inv.line_items) || [];
    const primary  = primaryWing(wing_assignment_mode, wing_id, wing_splits, items);

    await db.transaction(async (trx) => {
      await trx('invoice_wing_splits').where({ invoice_id: req.params.id }).delete();
      const upd = { wing_assignment_mode, business_wing_id: primary };
      if (line_items) upd.line_items = JSON.stringify(line_items);
      await trx('invoices').where({ id: req.params.id }).update(upd);

      if (wing_assignment_mode === 'split' && wing_splits.length) {
        await trx('invoice_wing_splits').insert(wing_splits.map(w => ({
          invoice_id: req.params.id, business_wing_id: w.business_wing_id,
          split_percentage: parseFloat(w.split_percentage), split_amount: parseFloat(w.split_amount),
          pkr_equivalent: inv.currency === 'PKR' ? parseFloat(w.split_amount) : parseFloat(w.split_amount) * exchRate,
        })));
      }
      if (wing_assignment_mode === 'line_item') {
        const splits = splitsFromLineItems(items, total, inv.currency, exchRate);
        if (splits.length) await trx('invoice_wing_splits').insert(splits.map(s => ({ invoice_id: req.params.id, ...s })));
      }
    });

    const updated = await db('invoices').where({ id: req.params.id }).first();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PATCH /:id/status ────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id }).first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const { status, received_date, received_bank_account_id, notes } = req.body;
    const update = { status };
    if (status === 'Received') {
      if (!received_date) return res.status(400).json({ error: 'received_date required' });
      update.received_date = received_date;
      update.received_bank_account_id = received_bank_account_id || null;
      if (notes) update.notes = notes;
    }
    const [updated] = await db('invoices').where({ id: req.params.id }).update(update).returning('*');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /:id/receive (legacy compat) ───────────────────────────────────────
router.post('/:id/receive', async (req, res) => {
  try {
    const { received_date, received_bank_account_id } = req.body;
    const [inv] = await db('invoices').where({ id: req.params.id })
      .update({ status: 'Received', received_date, received_bank_account_id: received_bank_account_id || null })
      .returning('*');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

const router  = require('express').Router();
const multer  = require('multer');
const crypto  = require('crypto');
const db      = require('../db');
const supabase = require('../supabaseClient');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

const BUCKET   = 'invoice-documents';
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp','image/tiff'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\-\.]/g, '_').replace(/_{2,}/g, '_');
}

function storagePath(wingId, date, invoiceId, filename) {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const fn = sanitizeFilename(filename);
  return `${wingId}/${y}/${m}/${invoiceId}_${fn}`;
}

function tempPath(filename) {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  const id  = crypto.randomUUID();
  return `temp/${y}/${m}/${id}_${sanitizeFilename(filename)}`;
}

async function moveFile(fromPath, toPath) {
  if (!supabase) return false;
  const { error } = await supabase.storage.from(BUCKET).move(fromPath, toPath);
  if (error) {
    console.warn('moveFile warning:', error.message);
    return false;
  }
  return true;
}

async function userCanViewWing(userId, wingId, role) {
  if (role === 'admin') return true;
  const row = await db('wing_access_grants').where({ user_id: userId, business_wing_id: wingId }).first();
  return !!row;
}

// ─── Text parser (for server-side extraction) ─────────────────────────────────
function parseInvoiceText(text) {
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  function get(patterns) {
    for (const re of patterns) { const m = text.match(re); if (m) return m[1]?.trim()||''; }
    return '';
  }
  function parseDate(str) {
    if (!str) return '';
    // "May 4, 2026" or "August 2 2026" (Month Day Year)
    const m3 = str.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
    if (m3) { const mo = months[m3[1].slice(0,3).toLowerCase()]; if (mo) return `${m3[3]}-${String(mo).padStart(2,'0')}-${String(m3[2]).padStart(2,'0')}`; }
    // "2 August 2026" or "2nd August 2026" (Day Month Year)
    const m1 = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (m1) { const mo = months[m1[2].slice(0,3).toLowerCase()]; if (mo) return `${m1[3]}-${String(mo).padStart(2,'0')}-${String(m1[1]).padStart(2,'0')}`; }
    // "02/08/2026" or "02-08-2026" (dd/mm/yyyy)
    const m2 = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    // ISO "2026-05-04"
    const m4 = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m4) return `${m4[1]}-${m4[2]}-${m4[3]}`;
    return '';
  }
  function cleanNum(s) { return parseFloat(String(s||'').replace(/,/g,''))||0; }

  const invoice_number = get([/invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i, /\binv[oice]*\s*#?\s*[:\-]?\s*([0-9]+)/i]);
  const invoice_date   = parseDate(get([
    /invoice\s+date\s*[:\-]\s*([^\n\r]+)/i,
    /(?:invoice\s+)?date\s*[:\-]\s*([^\n\r]+)/i,
    /dated?\s*[:\-]\s*([^\n\r]+)/i,
  ]));
  const due_date       = parseDate(get([
    /payment\s+due\s*[:\-]\s*([^\n\r]+)/i,
    /payment\s+due\s+date\s*[:\-]\s*([^\n\r]+)/i,
    /due\s+date\s*[:\-]\s*([^\n\r]+)/i,
    /due\s*[:\-]\s*([^\n\r]+)/i,
  ]));
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

// ─── Wing/split helpers ───────────────────────────────────────────────────────
function primaryWing(mode, wingId, splits, lineItems) {
  if (mode === 'single') return wingId;
  if (mode === 'split' && splits && splits.length)
    return splits.reduce((a,b) => parseFloat(b.split_percentage||0) > parseFloat(a.split_percentage||0) ? b : a).business_wing_id;
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

// Aggregate line items into per-wing splits.
// Tax is distributed proportionally so split_amounts always sum to total_amount
// and split_percentages always sum to 100%.
function splitsFromLineItems(lineItems, total, taxAmount, currency, exchRate) {
  const lineTotals = {};
  let assignedSubtotal = 0;
  for (const item of lineItems) {
    if (!item.business_wing_id) continue;
    const amt = parseFloat(item.amount || 0);
    lineTotals[item.business_wing_id] = (lineTotals[item.business_wing_id] || 0) + amt;
    assignedSubtotal += amt;
  }
  const tax = parseFloat(taxAmount || 0);
  return Object.entries(lineTotals).map(([wid, lineAmt]) => {
    // Proportional share of tax for this wing
    const taxShare = assignedSubtotal > 0 ? (lineAmt / assignedSubtotal) * tax : 0;
    const amt = parseFloat((lineAmt + taxShare).toFixed(2));
    return {
      business_wing_id: wid,
      split_amount: amt,
      split_percentage: total > 0 ? parseFloat((amt / total * 100).toFixed(4)) : 0,
      pkr_equivalent: currency === 'PKR' ? amt : parseFloat((amt * exchRate).toFixed(2)),
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /parse  (multipart file upload + extraction) ────────────────────────
router.post('/parse', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'A file (PDF or image) is required' });

    let temp_file_path = null;
    let parsed_fields  = { invoice_number:'', invoice_date:'', due_date:'', vendor_name:'', client_name:'', po_number_ref:'', currency:'PKR', tax_amount:'0', notes:'', line_items:[] };

    // ── Upload to Supabase Storage (best-effort — extraction continues even if this fails) ──
    if (supabase) {
      try {
        const tp = tempPath(file.originalname);
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(tp, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
        if (!upErr) temp_file_path = tp;
        else console.warn('Supabase storage warning:', upErr.message);
      } catch (storageErr) {
        console.warn('Supabase storage exception:', storageErr.message);
      }
    }

    // ── Extract text for PDFs ──
    if (file.mimetype === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const { text } = await pdfParse(file.buffer);
        parsed_fields = parseInvoiceText(text);
      } catch (err) {
        console.warn('pdf-parse warning:', err.message);
      }
    }

    res.json({
      parsed_fields,
      temp_file_path,
      file_name: file.originalname,
      file_size: file.size,
      file_type: file.mimetype,
    });
  } catch (err) {
    console.error('POST /invoices/parse error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /  ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, status, date_from, date_to, po_id, currency, search } = req.query;
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
    if (search && search.trim().length >= 2) {
      const like = `%${search.trim()}%`;
      q = q.where(function () {
        this.where('invoices.invoice_number', 'ilike', like)
          .orWhere('invoices.vendor_name',    'ilike', like)
          .orWhere('invoices.client_name',    'ilike', like)
          .orWhere('purchase_orders.po_number', 'ilike', like)
          .orWhere('business_wings.name',     'ilike', like);
      });
    }

    const limit = parseInt(req.query.limit, 10);
    if (limit > 0) q = q.limit(limit);

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
    // Strip raw storage path — expose metadata + has_file flag only
    res.json(invoices.map(({ source_file_path, ...inv }) => ({
      ...inv,
      has_file: !!source_file_path,
      wing_splits: splitsMap[inv.id] || [],
    })));
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
      const row = await db('invoices').where('po_id', inv.po_id).whereNot('id', inv.id).sum('total_amount as s').first();
      po_already_invoiced = parseFloat(row && row.s ? row.s : 0);
      po_remaining = parseFloat(inv.po_value||0) - po_already_invoiced - parseFloat(inv.total_amount||0);
    }

    // Never expose file path to client — only metadata
    const { source_file_path, ...safeInv } = inv;
    const hasFile = !!source_file_path;
    res.json({ ...safeInv, wing_splits, po_already_invoiced, po_remaining, has_file: hasFile });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /:id/file  (signed URL) ──────────────────────────────────────────────
router.get('/:id/file', async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id }).select('id','business_wing_id','source_file_path','source_file_name','source_file_type').first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (!inv.source_file_path) return res.status(404).json({ error: 'No file attached to this invoice' });

    const allowed = await userCanViewWing(req.user.id, inv.business_wing_id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    if (!supabase) return res.status(503).json({ error: 'Storage not configured' });

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(inv.source_file_path, 3600);
    if (error) {
      console.error('createSignedUrl error', error);
      return res.status(500).json({ error: 'Could not generate file URL. The file may have been deleted.' });
    }

    res.json({ signed_url: data.signedUrl, expires_in: 3600, file_name: inv.source_file_name, file_type: inv.source_file_type });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /:id/file  (attach / replace file on an existing invoice) ──────────
router.post('/:id/file', upload.single('file'), async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id })
      .select('id', 'business_wing_id', 'invoice_date', 'source_file_path').first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const allowed = await userCanViewWing(req.user.id, inv.business_wing_id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'A file (PDF or image) is required' });
    if (!supabase) return res.status(503).json({ error: 'Storage not configured' });

    // Remove existing file from storage before replacing
    if (inv.source_file_path) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([inv.source_file_path]);
      if (rmErr) console.warn('Remove old file warning:', rmErr.message);
    }

    const path = storagePath(inv.business_wing_id, new Date(inv.invoice_date), inv.id, file.originalname);
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (upErr) return res.status(500).json({ error: 'Upload failed', detail: upErr.message });

    await db('invoices').where({ id: req.params.id }).update({
      source_file_path:        path,
      source_file_name:        file.originalname,
      source_file_size:        file.size,
      source_file_type:        file.mimetype,
      source_file_uploaded_at: new Date(),
    });

    res.json({ has_file: true, file_name: file.originalname, file_size: file.size, file_type: file.mimetype });
  } catch (err) {
    console.error('POST /invoices/:id/file', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id/file  (admin only) ───────────────────────────────────────────
router.delete('/:id/file', requireAdmin, async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id }).select('id','source_file_path','source_file_name').first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (!inv.source_file_path) return res.status(404).json({ error: 'No file attached' });

    if (supabase) {
      const { error } = await supabase.storage.from(BUCKET).remove([inv.source_file_path]);
      if (error) console.warn('Storage remove warning:', error.message);
    }

    await db('invoices').where({ id: req.params.id }).update({
      source_file_path: null, source_file_name: null, source_file_size: null,
      source_file_type: null, source_file_uploaded_at: null,
    });
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /  (create invoice + finalize file) ─────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      wing_assignment_mode = 'single',
      wing_id, wing_splits = [],
      invoice_number, vendor_name, client_name,
      invoice_date, due_date, currency = 'PKR', exchange_rate,
      total_amount, tax_amount, line_items = [], po_id, notes,
      // File fields from parse step
      temp_file_path, file_name, file_size, file_type,
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
        const taxAmt = parseFloat(tax_amount) || 0;
        const splits = splitsFromLineItems(line_items, total, taxAmt, currency, exchRate);
        if (splits.length) await trx('invoice_wing_splits').insert(splits.map(s => ({ invoice_id: inv.id, ...s })));
      }
      return inv;
    });

    // ── Move file from temp → final path ──
    if (temp_file_path && file_name && supabase) {
      const final = storagePath(primary, new Date(invoice_date), invoice.id, file_name);
      const moved = await moveFile(temp_file_path, final);
      const actualPath = moved ? final : temp_file_path;
      await db('invoices').where({ id: invoice.id }).update({
        source_file_path:        actualPath,
        source_file_name:        file_name,
        source_file_size:        file_size   || null,
        source_file_type:        file_type   || null,
        source_file_uploaded_at: new Date(),
      });
      invoice.has_file = true;
    }

    res.status(201).json({ ...invoice, has_file: !!(temp_file_path && supabase) });
  } catch (err) {
    console.error('POST /invoices', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Duplicate invoice number for this vendor' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id }).first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'Received')
      return res.status(409).json({ error: 'Received invoices cannot be edited' });

    const {
      invoice_number, vendor_name, client_name,
      invoice_date, due_date, currency, exchange_rate,
      tax_amount, line_items, notes, po_id, needs_review,
    } = req.body;

    const update = {};
    if (invoice_number !== undefined) update.invoice_number = invoice_number;
    if (vendor_name    !== undefined) update.vendor_name    = vendor_name    || null;
    if (client_name    !== undefined) update.client_name    = client_name    || null;
    if (invoice_date   !== undefined) update.invoice_date   = invoice_date;
    if (due_date       !== undefined) update.due_date       = due_date       || null;
    if (currency       !== undefined) update.currency       = currency;
    if (notes          !== undefined) update.notes          = notes          || null;
    if (po_id          !== undefined) update.po_id          = po_id          || null;
    if (needs_review   !== undefined) update.needs_review   = needs_review;

    // Recalculate totals when financial fields change
    const newCurrency    = currency       ?? inv.currency;
    const newExchRate    = parseFloat(exchange_rate ?? inv.exchange_rate) || 1;
    const newTaxAmount   = parseFloat(tax_amount    ?? inv.tax_amount)    || 0;
    const newLineItems   = line_items !== undefined
      ? line_items
      : (typeof inv.line_items === 'string' ? JSON.parse(inv.line_items || '[]') : inv.line_items || []);

    if (exchange_rate !== undefined) update.exchange_rate = newExchRate;
    if (tax_amount    !== undefined) update.tax_amount    = newTaxAmount;
    if (line_items    !== undefined) update.line_items    = JSON.stringify(newLineItems);

    if (exchange_rate !== undefined || tax_amount !== undefined || line_items !== undefined) {
      const lineSubtotal  = newLineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
      const newTotal      = lineSubtotal + newTaxAmount;
      update.total_amount    = newTotal;
      update.pkr_equivalent  = newCurrency === 'PKR' ? newTotal : newTotal * newExchRate;
    }

    const [updated] = await db('invoices').where({ id: req.params.id }).update(update).returning('*');
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error', detail: err.message }); }
});

// ─── PATCH /:id/wing-assignment ───────────────────────────────────────────────
router.patch('/:id/wing-assignment', async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id }).first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'Received')
      return res.status(409).json({ error: 'Wing assignment cannot be changed after payment is recorded.' });

    const { wing_assignment_mode, wing_id, wing_splits = [], line_items } = req.body;
    if (!wing_assignment_mode) return res.status(400).json({ error: 'wing_assignment_mode required' });

    const total    = parseFloat(inv.total_amount);
    const taxAmt   = parseFloat(inv.tax_amount) || 0;
    const exchRate = parseFloat(inv.exchange_rate) || 1;
    const items    = line_items || (typeof inv.line_items === 'string' ? JSON.parse(inv.line_items || '[]') : inv.line_items) || [];

    // Validate line_item mode — same guard as POST /
    if (wing_assignment_mode === 'line_item') {
      const unassigned = items.filter(i => parseFloat(i.amount || 0) > 0 && !i.business_wing_id);
      if (unassigned.length)
        return res.status(400).json({ error: `${unassigned.length} line item(s) missing wing assignment` });
    }

    const primary = primaryWing(wing_assignment_mode, wing_id, wing_splits, items);

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
        const splits = splitsFromLineItems(items, total, taxAmt, inv.currency, exchRate);
        if (splits.length) await trx('invoice_wing_splits').insert(splits.map(s => ({ invoice_id: req.params.id, ...s })));
      }
    });
    const updated = await db('invoices').where({ id: req.params.id }).first();
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Server error', detail: err.message }); }
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
  } catch (err) { res.status(500).json({ error: 'Server error', detail: err.message }); }
});

// ─── DELETE /:id  (remove invoice + its file from storage) ───────────────────
router.delete('/:id', async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id })
      .select('id', 'business_wing_id', 'source_file_path', 'status').first();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'Received')
      return res.status(409).json({ error: 'Received invoices cannot be deleted. Reverse the payment record first.' });

    const allowed = await userCanViewWing(req.user.id, inv.business_wing_id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    // Remove file from storage (best-effort — don't block delete on storage failure)
    if (inv.source_file_path && supabase) {
      const { error } = await supabase.storage.from(BUCKET).remove([inv.source_file_path]);
      if (error) console.warn('Storage delete warning:', error.message);
    }

    await db.transaction(async (trx) => {
      await trx('invoice_wing_splits').where({ invoice_id: req.params.id }).delete();
      await trx('invoices').where({ id: req.params.id }).delete();
    });

    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    console.error('DELETE /invoices/:id', err);
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
  } catch (err) { res.status(500).json({ error: 'Server error', detail: err.message }); }
});

module.exports = router;

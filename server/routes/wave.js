const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const WAVE_GQL    = 'https://gql.waveapps.com/graphql/public';
const WAVE_TOKEN  = () => process.env.WAVE_API_TOKEN;
const WAVE_BIZ_ID = () => process.env.WAVE_BUSINESS_ID;

async function waveQuery(query, variables = {}) {
  const res = await fetch(WAVE_GQL, {
    method:  'POST',
    headers: { Authorization: `Bearer ${WAVE_TOKEN()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Wave API HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

const INVOICES_QUERY = `
  query($businessId: ID!, $page: Int!) {
    business(id: $businessId) {
      invoices(page: $page, pageSize: 100) {
        pageInfo { currentPage totalPages }
        edges {
          node {
            id
            invoiceNumber
            status
            invoiceDate
            dueDate
            memo
            total      { raw currency { code } }
            amountDue  { raw }
            customer   { name email }
            items {
              description
              quantity
              unitPrice
              subtotal { raw }
              taxes { amount { raw } salesTax { name rate } }
            }
          }
        }
      }
    }
  }
`;

// GET /wave/test — verify credentials
router.get('/test', async (req, res) => {
  if (!WAVE_TOKEN() || !WAVE_BIZ_ID())
    return res.status(500).json({ ok: false, error: 'WAVE_API_TOKEN or WAVE_BUSINESS_ID not configured' });
  try {
    const data = await waveQuery(`query { businesses { edges { node { id name } } } }`);
    res.json({ ok: true, businesses: data.businesses.edges.map(e => e.node) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /wave/staging — unreviewed staged invoices
router.get('/staging', async (req, res) => {
  try {
    const records = await db('wave_invoice_staging')
      .where({ reviewed: false })
      .orderBy('invoice_date', 'desc');
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// POST /wave/sync — fetch ONE page from Wave per call to avoid gateway timeouts.
// Frontend loops through pages automatically when has_more=true.
router.post('/sync', async (req, res) => {
  if (!WAVE_TOKEN() || !WAVE_BIZ_ID())
    return res.status(500).json({ error: 'WAVE_API_TOKEN and WAVE_BUSINESS_ID env vars are required' });

  const page = parseInt(req.body.page || req.query.page || 1, 10);

  try {
    // Abort the Wave request if it takes more than 25 s (leaves headroom for DB work)
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 25000);

    let waveData;
    try {
      const fetchRes = await fetch(WAVE_GQL, {
        method:  'POST',
        headers: { Authorization: `Bearer ${WAVE_TOKEN()}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: INVOICES_QUERY, variables: { businessId: WAVE_BIZ_ID(), page } }),
        signal:  controller.signal,
      });
      clearTimeout(timeout);
      if (!fetchRes.ok) throw new Error(`Wave API HTTP ${fetchRes.status}`);
      const json = await fetchRes.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      waveData = json.data;
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError')
        return res.status(504).json({ error: 'Wave API did not respond in time. Try again.' });
      throw fetchErr;
    }

    const { invoices } = waveData.business;
    const totalPages   = invoices.pageInfo.totalPages || 1;
    const pageInvoices = invoices.edges.map(e => e.node);

    // Skip wave_invoice_ids already in staging (reviewed or not)
    const existingIds = new Set(
      await db('wave_invoice_staging').pluck('wave_invoice_id')
    );

    const toInsert = pageInvoices.filter(wi => !existingIds.has(wi.id));

    let imported = 0;
    for (const wi of toInsert) {
      const lineItems = (wi.items || []).map(item => ({
        description: item.description || '',
        quantity:    parseFloat(item.quantity)      || 1,
        unit_price:  parseFloat(item.unitPrice)     || 0,
        amount:      parseFloat(item.subtotal?.raw) || 0,
        notes: '',
      }));

      const taxAmount = (wi.items || []).reduce((sum, item) =>
        sum + (item.taxes || []).reduce((s, t) => s + parseFloat(t.amount?.raw || 0), 0), 0);

      await db('wave_invoice_staging').insert({
        wave_invoice_id: wi.id,
        wave_status:     wi.status        || null,
        invoice_number:  wi.invoiceNumber || `WAVE-${wi.id.slice(-8)}`,
        client_name:     wi.customer?.name || null,
        invoice_date:    wi.invoiceDate   || new Date().toISOString().split('T')[0],
        due_date:        wi.dueDate       || null,
        currency:        wi.total?.currency?.code || 'USD',
        total_amount:    parseFloat(wi.total?.raw || 0),
        tax_amount:      taxAmount,
        line_items:      JSON.stringify(lineItems),
        notes:           wi.memo || null,
      }).onConflict('wave_invoice_id').ignore(); // guard against race conditions
      imported++;
    }

    const pending = await db('wave_invoice_staging').where({ reviewed: false }).count('id as n').first();

    res.json({
      page,
      total_pages: totalPages,
      has_more:    page < totalPages,
      next_page:   page < totalPages ? page + 1 : null,
      imported,
      skipped:     pageInvoices.length - toInsert.length,
      pending:     parseInt(pending.n, 10),
    });
  } catch (err) {
    console.error('Wave sync error:', err);
    res.status(500).json({ error: 'Wave sync failed', detail: err.message });
  }
});

// POST /wave/staging/:id/finalize — assign wing/PO and create invoice
router.post('/staging/:id/finalize', async (req, res) => {
  try {
    const staged = await db('wave_invoice_staging')
      .where({ id: req.params.id, reviewed: false }).first();
    if (!staged) return res.status(404).json({ error: 'Staging record not found or already reviewed' });

    const {
      wing_assignment_mode = 'single',
      wing_id, wing_splits = [],
      po_id, exchange_rate,
      client_name,
    } = req.body;

    if (wing_assignment_mode === 'single' && !wing_id)
      return res.status(400).json({ error: 'wing_id required for single mode' });
    if (wing_assignment_mode === 'split' && !wing_splits.length)
      return res.status(400).json({ error: 'wing_splits required for split mode' });

    const exchRate = parseFloat(exchange_rate) || 1;
    const total    = parseFloat(staged.total_amount) || 0;
    const taxAmt   = parseFloat(staged.tax_amount)   || 0;
    const pkr_eq   = staged.currency === 'PKR' ? total : total * exchRate;

    const primaryWingId = wing_assignment_mode === 'single'
      ? wing_id
      : wing_splits[0]?.business_wing_id;

    if (!primaryWingId) return res.status(400).json({ error: 'Could not determine primary wing' });

    const invoice = await db.transaction(async trx => {
      const [inv] = await trx('invoices').insert({
        invoice_number:       staged.invoice_number,
        client_name:          client_name || staged.client_name || null,
        vendor_name:          null,
        invoice_date:         staged.invoice_date,
        due_date:             staged.due_date      || null,
        currency:             staged.currency,
        exchange_rate:        exchRate,
        total_amount:         total,
        pkr_equivalent:       pkr_eq,
        tax_amount:           taxAmt,
        line_items:           staged.line_items,
        notes:                staged.notes          || null,
        status:               'Pending',
        source:               'wave',
        business_wing_id:     primaryWingId,
        wing_assignment_mode,
        po_id:                po_id || null,
      }).returning('*');

      if (wing_assignment_mode === 'split' && wing_splits.length) {
        await trx('invoice_wing_splits').insert(wing_splits.map(w => ({
          invoice_id:        inv.id,
          business_wing_id:  w.business_wing_id,
          split_percentage:  parseFloat(w.split_percentage),
          split_amount:      parseFloat(w.split_amount),
          pkr_equivalent:    staged.currency === 'PKR'
            ? parseFloat(w.split_amount)
            : parseFloat(w.split_amount) * exchRate,
        })));
      }

      await trx('wave_invoice_staging')
        .where({ id: req.params.id })
        .update({ reviewed: true, invoice_id: inv.id });

      return inv;
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error('Wave finalize error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Invoice number already exists' });
    res.status(500).json({ error: 'Failed to create invoice', detail: err.message });
  }
});

module.exports = router;

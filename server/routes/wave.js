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

// GET /wave/test — verify credentials are configured
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

// POST /wave/sync — import new Wave invoices; never overwrite existing
router.post('/sync', async (req, res) => {
  if (!WAVE_TOKEN() || !WAVE_BIZ_ID())
    return res.status(500).json({ error: 'WAVE_API_TOKEN and WAVE_BUSINESS_ID env vars are required' });

  try {
    // Paginate through all Wave invoices
    let page = 1, totalPages = 1;
    const allWaveInvoices = [];

    while (page <= totalPages) {
      const data = await waveQuery(INVOICES_QUERY, { businessId: WAVE_BIZ_ID(), page });
      const { invoices } = data.business;
      totalPages = invoices.pageInfo.totalPages || 1;
      allWaveInvoices.push(...invoices.edges.map(e => e.node));
      page++;
    }

    // Skip any wave_invoice_id that already exists locally
    const existingIds = new Set(
      await db('invoices').whereNotNull('wave_invoice_id').pluck('wave_invoice_id')
    );

    const toInsert = allWaveInvoices.filter(wi => !existingIds.has(wi.id));

    let imported = 0;
    for (const wi of toInsert) {
      const lineItems = (wi.items || []).map(item => ({
        description: item.description || '',
        quantity:    parseFloat(item.quantity)        || 1,
        unit_price:  parseFloat(item.unitPrice)       || 0,
        amount:      parseFloat(item.subtotal?.raw)   || 0,
        notes: '',
      }));

      const taxAmount = (wi.items || []).reduce((sum, item) =>
        sum + (item.taxes || []).reduce((s, t) => s + parseFloat(t.amount?.raw || 0), 0), 0);

      const currency = wi.total?.currency?.code || 'PKR';
      const total    = parseFloat(wi.total?.raw  || 0);

      await db('invoices').insert({
        invoice_number:       wi.invoiceNumber || `WAVE-${wi.id.slice(-8)}`,
        client_name:          wi.customer?.name || null,
        vendor_name:          null,
        invoice_date:         wi.invoiceDate   || new Date().toISOString().split('T')[0],
        due_date:             wi.dueDate       || null,
        currency,
        exchange_rate:        1,
        total_amount:         total,
        pkr_equivalent:       currency === 'PKR' ? total : 0,
        tax_amount:           taxAmount,
        line_items:           JSON.stringify(lineItems),
        notes:                wi.memo          || null,
        status:               'Pending',
        source:               'wave',
        wave_invoice_id:      wi.id,
        needs_review:         true,
        wing_assignment_mode: 'single',
        business_wing_id:     null,
      });
      imported++;
    }

    res.json({
      imported,
      skipped: allWaveInvoices.length - toInsert.length,
      total:   allWaveInvoices.length,
    });
  } catch (err) {
    console.error('Wave sync error:', err);
    res.status(500).json({ error: 'Wave sync failed', detail: err.message });
  }
});

module.exports = router;

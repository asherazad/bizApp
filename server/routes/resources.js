const router  = require('express').Router();
const multer  = require('multer');
const XLSX    = require('xlsx');
const db      = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Excel date serial → ISO date string ─────────────────────────────────────
function excelDateToISO(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  const n = Number(val);
  if (!n || n < 1) return null;
  // Excel serial: days since 1900-01-01 with Lotus leap-year bug; 25569 = Unix epoch in Excel days
  const d = new Date((n - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ─── Map one Excel row to a DB-ready object ───────────────────────────────────
function normaliseRow(row, wings) {
  const label = String(row['Business wing'] || row['Business Wing'] || '').trim().toLowerCase();
  const wing  = wings.find(w =>
    w.name?.toLowerCase() === label ||
    w.code?.toLowerCase() === label ||
    label.includes(w.code?.toLowerCase())
  );
  return {
    resource_seq_id:   parseInt(row['Resource ID'] || row['resource_id']) || null,
    full_name:         String(row['Name'] || '').trim() || null,
    business_wing_id:  wing?.id || null,
    designation:       String(row['Designation'] || '').trim() || null,
    cnic:              String(row['CNIC'] || '').replace(/\s/g, '') || null,
    account_number:    String(row['Account Number'] || '').trim() || null,
    bank_name:         String(row['Bank Name'] || '').trim() || null,
    mode_of_transfer:  String(row['Mode of Transfer'] || '').trim() || null,
    job_type:          String(row['Job Type'] || '').trim() || null,
    employment_status: String(row['Status'] || '').trim() || null,
    join_date:         excelDateToISO(row['Joining Date']),
    gross_salary:      parseFloat(row['Gross Salary']) || 0,
    tax_amount:        parseFloat(row['Tax']) || 0,
    net_salary:        parseFloat(row['Net Salary Payable (PKR)'] || row['Net Salary Payable']) || 0,
    is_active:         true,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /import  — must come before /:id to avoid route collision ───────────
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'An Excel file (.xlsx / .xls) is required' });

    const wb   = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return res.status(400).json({ error: 'Sheet is empty or has no data rows' });

    const wings = await db('business_wings').select('id', 'name', 'code');

    const inserted = [], skipped = [];

    for (const row of rows) {
      const name = String(row['Name'] || '').trim();
      if (!name) { skipped.push({ reason: 'empty name' }); continue; }

      const obj = normaliseRow(row, wings);
      try {
        // Upsert by CNIC (unique) or full_name to handle re-imports
        let existing = null;
        if (obj.cnic) existing = await db('resources').where({ cnic: obj.cnic }).first();
        if (!existing) existing = await db('resources').where({ full_name: obj.full_name }).first();

        if (existing) {
          await db('resources').where({ id: existing.id }).update(obj);
          inserted.push({ name: obj.full_name, action: 'updated' });
        } else {
          await db('resources').insert(obj);
          inserted.push({ name: obj.full_name, action: 'inserted' });
        }
      } catch (e) {
        skipped.push({ name: obj.full_name, reason: e.message });
      }
    }

    const added   = inserted.filter(r => r.action === 'inserted').length;
    const updated = inserted.filter(r => r.action === 'updated').length;
    res.json({
      message: `Import complete — ${added} added, ${updated} updated${skipped.length ? `, ${skipped.length} skipped` : ''}`,
      added, updated, skipped,
    });
  } catch (err) {
    console.error('POST /resources/import', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /  ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, employment_status, job_type, search } = req.query;
    let q = db('resources')
      .leftJoin('business_wings', 'business_wings.id', 'resources.business_wing_id')
      .select(
        'resources.id', 'resources.resource_seq_id', 'resources.full_name',
        'resources.cnic', 'resources.account_number', 'resources.bank_name',
        'resources.mode_of_transfer', 'resources.designation',
        'resources.job_type', 'resources.employment_status',
        'resources.join_date', 'resources.gross_salary',
        'resources.tax_amount', 'resources.net_salary',
        'resources.is_active', 'resources.created_at',
        'business_wings.name as wing_name', 'business_wings.code as wing_code'
      )
      .orderByRaw('resources.resource_seq_id ASC NULLS LAST, resources.full_name ASC NULLS LAST');

    if (wing_id)           q = q.where('resources.business_wing_id', wing_id);
    if (employment_status) q = q.where('resources.employment_status', employment_status);
    if (job_type)          q = q.where('resources.job_type', job_type);
    if (search)            q = q.whereRaw('resources.full_name ILIKE ?', [`%${search}%`]);

    res.json(await q);
  } catch (err) {
    console.error('GET /resources', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /:id  ────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const resource = await db('resources')
      .leftJoin('business_wings', 'business_wings.id', 'resources.business_wing_id')
      .where('resources.id', req.params.id)
      .select('resources.*', 'business_wings.name as wing_name', 'business_wings.code as wing_code')
      .first();
    if (!resource) return res.status(404).json({ error: 'Not found' });

    const inventory = await db('resource_inventory')
      .where({ resource_id: req.params.id })
      .orderBy('assigned_date', 'desc');

    res.json({ ...resource, inventory });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /  (single create) ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      business_wing_id, full_name, cnic, designation,
      account_number, bank_name, mode_of_transfer,
      job_type, employment_status, join_date,
      gross_salary, tax_amount, net_salary,
    } = req.body;

    if (!full_name) return res.status(400).json({ error: 'full_name is required' });

    const [resource] = await db('resources').insert({
      business_wing_id: business_wing_id || null,
      full_name, cnic: cnic || null,
      designation: designation || null,
      account_number: account_number || null,
      bank_name: bank_name || null,
      mode_of_transfer: mode_of_transfer || null,
      job_type: job_type || null,
      employment_status: employment_status || null,
      join_date: join_date || null,
      gross_salary: parseFloat(gross_salary) || 0,
      tax_amount:   parseFloat(tax_amount)   || 0,
      net_salary:   parseFloat(net_salary)   || 0,
      is_active: true,
    }).returning('*');

    res.status(201).json(resource);
  } catch (err) {
    console.error('POST /resources', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id  ────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = [
      'business_wing_id', 'full_name', 'cnic', 'designation',
      'account_number', 'bank_name', 'mode_of_transfer',
      'job_type', 'employment_status', 'join_date',
      'gross_salary', 'tax_amount', 'net_salary', 'is_active',
    ];
    const update = Object.fromEntries(allowed.filter(k => k in req.body).map(k => [k, req.body[k]]));
    const [resource] = await db('resources').where({ id: req.params.id }).update(update).returning('*');
    if (!resource) return res.status(404).json({ error: 'Not found' });
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id  ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await db('resources').where({ id: req.params.id }).delete();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Resource deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /:id/inventory  ─────────────────────────────────────────────────────
router.get('/:id/inventory', async (req, res) => {
  try {
    const items = await db('resource_inventory')
      .where({ resource_id: req.params.id })
      .orderBy('assigned_date', 'desc');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /:id/inventory  ────────────────────────────────────────────────────
router.post('/:id/inventory', async (req, res) => {
  try {
    const { item_name, description, serial_number, assigned_date, notes } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name is required' });

    const exists = await db('resources').where({ id: req.params.id }).first();
    if (!exists) return res.status(404).json({ error: 'Resource not found' });

    const [item] = await db('resource_inventory').insert({
      resource_id:   req.params.id,
      item_name:     item_name.trim(),
      description:   description   || null,
      serial_number: serial_number || null,
      assigned_date: assigned_date || new Date().toISOString().split('T')[0],
      notes:         notes || null,
    }).returning('*');

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id/inventory/:itemId  ──────────────────────────────────────────
router.delete('/:id/inventory/:itemId', async (req, res) => {
  try {
    const deleted = await db('resource_inventory')
      .where({ id: req.params.itemId, resource_id: req.params.id })
      .delete();
    if (!deleted) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

const router  = require('express').Router();
const multer  = require('multer');
const XLSX    = require('xlsx');
const db      = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const TODAY = () => new Date().toISOString().split('T')[0];

// ─── Excel date serial → ISO date string ─────────────────────────────────────
function excelDateToISO(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  const n = Number(val);
  if (!n || n < 1) return null;
  const d = new Date((n - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ─── Map one Excel row to a DB-ready object ───────────────────────────────────
// Covers all actual DB columns (both original and those added by migration)
function normaliseRow(row, wings) {
  const label = String(row['Business wing'] || row['Business Wing'] || '').trim().toLowerCase();
  const wing  = wings.find(w =>
    w.name?.toLowerCase() === label ||
    w.code?.toLowerCase() === label ||
    (label && label.includes(w.code?.toLowerCase()))
  );

  const employmentStatus = String(row['Status'] || '').trim() || null;
  const grossSalary      = parseFloat(row['Gross Salary']) || 0;

  return {
    // ── new columns (added by migration) ─────────────────────────────────────
    resource_seq_id:   parseInt(row['Resource ID'] || row['resource_id']) || null,
    full_name:         String(row['Name'] || '').trim() || null,
    business_wing_id:  wing?.id || null,
    designation:       String(row['Designation'] || '').trim() || null,
    cnic:              String(row['CNIC'] || '').replace(/\s/g, '') || null,
    account_number:    String(row['Account Number'] || '').trim() || null,
    bank_name:         String(row['Bank Name'] || '').trim() || null,
    mode_of_transfer:  String(row['Mode of Transfer'] || '').trim() || null,
    job_type:          String(row['Job Type'] || '').trim() || null,
    employment_status: employmentStatus,
    join_date:         excelDateToISO(row['Joining Date']) || TODAY(),
    gross_salary:      grossSalary,
    tax_amount:        parseFloat(row['Tax']) || 0,
    net_salary:        parseFloat(row['Net Salary Payable (PKR)'] || row['Net Salary Payable']) || 0,
    // ── original columns that may be NOT NULL ─────────────────────────────────
    resource_type:     'employee',
    status:            employmentStatus || 'active',
    basic_salary:      grossSalary,
    annual_leaves:     0,
  };
}

// ─── Safe insert payload for manual create ────────────────────────────────────
function buildInsertPayload(body) {
  const {
    business_wing_id, full_name, cnic, designation,
    account_number, bank_name, mode_of_transfer,
    job_type, employment_status, join_date,
    gross_salary, tax_amount, net_salary,
  } = body;

  const gs = parseFloat(gross_salary) || 0;
  const es = (employment_status || '').trim() || null;

  return {
    full_name:         full_name,
    business_wing_id:  business_wing_id || null,
    cnic:              cnic              || null,
    designation:       designation       || null,
    account_number:    account_number    || null,
    bank_name:         bank_name         || null,
    mode_of_transfer:  mode_of_transfer  || null,
    job_type:          job_type          || null,
    employment_status: es,
    join_date:         join_date         || TODAY(),
    gross_salary:      gs,
    tax_amount:        parseFloat(tax_amount) || 0,
    net_salary:        parseFloat(net_salary) || 0,
    // original NOT NULL columns — provide safe defaults
    resource_type:     'employee',
    status:            es || 'active',
    basic_salary:      gs,
    annual_leaves:     0,
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
    // Surface first skip reason so user can diagnose DB issues immediately
    const firstError = skipped.find(s => s.reason)?.reason || null;
    res.json({
      message: `Import complete — ${added} added, ${updated} updated${skipped.length ? `, ${skipped.length} skipped` : ''}${firstError ? ' | First error: ' + firstError : ''}`,
      added, updated, skipped,
    });
  } catch (err) {
    console.error('POST /resources/import', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /test  — quick diagnostic, no column enumeration ────────────────────
router.get('/test', async (req, res) => {
  try {
    const count = await db('resources').count('id as n').first();
    const cols  = await db.raw(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'resources'
      ORDER BY ordinal_position
    `);
    res.json({ ok: true, row_count: count.n, columns: cols.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /  ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, employment_status, job_type, search } = req.query;

    // Use r.* to avoid hard-coding column names — works regardless of exact schema
    let q = db('resources as r')
      .leftJoin('business_wings as bw', 'bw.id', 'r.business_wing_id')
      .select('r.*', 'bw.name as wing_name', 'bw.code as wing_code')
      .orderByRaw('r.resource_seq_id ASC NULLS LAST, r.full_name ASC NULLS LAST');

    if (wing_id)           q = q.where('r.business_wing_id', wing_id);
    if (employment_status) q = q.whereRaw(
      '(r.employment_status = ? OR r.status = ?)',
      [employment_status, employment_status]
    );
    if (job_type)          q = q.where('r.job_type', job_type);
    if (search)            q = q.whereRaw('r.full_name ILIKE ?', [`%${search}%`]);

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
    if (!req.body.full_name) return res.status(400).json({ error: 'full_name is required' });

    const [resource] = await db('resources')
      .insert(buildInsertPayload(req.body))
      .returning('*');

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
      'job_type', 'employment_status', 'status',
      'join_date', 'gross_salary', 'tax_amount', 'net_salary',
      'basic_salary', 'resource_type',
    ];
    const update = Object.fromEntries(
      allowed.filter(k => k in req.body).map(k => [k, req.body[k]])
    );
    // Keep status in sync with employment_status
    if ('employment_status' in update && !('status' in update)) {
      update.status = update.employment_status || 'active';
    }
    if ('gross_salary' in update && !('basic_salary' in update)) {
      update.basic_salary = parseFloat(update.gross_salary) || 0;
    }

    const [resource] = await db('resources')
      .where({ id: req.params.id })
      .update(update)
      .returning('*');
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
      assigned_date: assigned_date || TODAY(),
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

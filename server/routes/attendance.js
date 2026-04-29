const router = require('express').Router();
const multer = require('multer');
const XLSX   = require('xlsx');
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Parse a biometric Date/Time cell into a JS Date ─────────────────────────
// Handles multiple formats seen in biometric exports:
//   • JS Date objects (cellDates:true)
//   • Excel serial numbers
//   • "DD-Mon-YY H:MM:SS AM/PM"  ← actual format from screenshot
//   • "DD/MM/YYYY HH:MM[:SS]"
//   • ISO / any format JS Date can parse natively
const MONTH_IDX = {
  jan:0,feb:1,mar:2,apr:3,may:4,jun:5,
  jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
};

function parseBiometricDateTime(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' && val > 1) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;

  // Format: "02-Apr-26 1:43:18 PM" (DD-Mon-YY H:MM:SS AM/PM)
  const m1 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (m1) {
    const [, day, mon, yr, hr, min, sec, ampm] = m1;
    const month = MONTH_IDX[mon.toLowerCase()];
    if (month !== undefined) {
      let hour = parseInt(hr, 10);
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      const d = new Date(2000 + parseInt(yr, 10), month, parseInt(day, 10), hour, parseInt(min, 10), parseInt(sec, 10));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Format: "DD/MM/YYYY HH:MM[:SS]"
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
  if (m2) {
    const d = new Date(`${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}T${m2[4]}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback: native JS parse (handles ISO and many other formats)
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ─── POST /import — biometric Excel ──────────────────────────────────────────
// Must be defined before /:id routes to avoid route collision.
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'An Excel file (.xlsx / .xls) is required' });

    const wb   = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return res.status(400).json({ error: 'Sheet is empty or has no data rows' });

    // Build lookup: resource_seq_id (integer) → resource row
    const resources = await db('resources')
      .whereNotNull('resource_seq_id')
      .select('id', 'resource_seq_id', 'full_name', 'business_wing_id');
    const resourceMap = {};
    for (const r of resources) resourceMap[parseInt(r.resource_seq_id)] = r;

    // Collect valid punches from the sheet
    const punches = [];
    for (const row of rows) {
      // Support "No.", "No", "ID" column names
      const rawId  = row['No.'] ?? row['No'] ?? row['ID'] ?? '';
      const rawDt  = row['Date/Time'] ?? row['DateTime'] ?? row['Time'] ?? row['date_time'] ?? '';
      const seqId  = parseInt(rawId);
      if (!seqId || !rawDt) continue;

      const dt = parseBiometricDateTime(rawDt);
      if (!dt) continue;

      const date    = dt.toISOString().split('T')[0];           // YYYY-MM-DD
      const timePad = (n) => String(n).padStart(2, '0');
      const time    = `${timePad(dt.getHours())}:${timePad(dt.getMinutes())}`; // HH:MM
      punches.push({ seqId, date, time });
    }

    if (!punches.length) {
      return res.status(400).json({
        error: 'No valid punch records found. Verify the sheet has "No." and "Date/Time" columns.',
      });
    }

    // Group punches by (seqId, date) — collect all times per person per day
    const grouped = {};
    for (const p of punches) {
      const key = `${p.seqId}_${p.date}`;
      if (!grouped[key]) grouped[key] = { seqId: p.seqId, date: p.date, times: [] };
      grouped[key].times.push(p.time);
    }

    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const entry of Object.values(grouped)) {
      const resource = resourceMap[entry.seqId];
      if (!resource) {
        skipped++;
        if (errors.length < 5) errors.push(`No resource found for ID ${entry.seqId}`);
        continue;
      }

      // Sort times ascending; first = check-in, last = check-out
      entry.times.sort();
      const check_in  = entry.times[0];
      const check_out = entry.times.length > 1 ? entry.times[entry.times.length - 1] : null;

      try {
        const existing = await db('attendance_records')
          .where({ resource_id: resource.id, record_date: entry.date })
          .first();

        if (existing) {
          await db('attendance_records')
            .where({ id: existing.id })
            .update({ check_in, check_out, status: 'present' });
          updated++;
        } else {
          await db('attendance_records').insert({
            resource_id: resource.id,
            record_date: entry.date,
            status:      'present',
            check_in,
            check_out,
          });
          inserted++;
        }
      } catch (e) {
        skipped++;
        if (errors.length < 5) errors.push(`${resource.full_name} ${entry.date}: ${e.message}`);
      }
    }

    const firstError = errors[0] || null;
    res.json({
      message: `Import complete — ${inserted} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}${firstError ? ' | ' + firstError : ''}`,
      inserted, updated, skipped,
    });
  } catch (err) {
    console.error('POST /attendance/import', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, from, to, status } = req.query;
    let q = db('attendance_records')
      .join('resources', 'resources.id', 'attendance_records.resource_id')
      .select('attendance_records.*', 'resources.full_name as resource_name', 'resources.business_wing_id')
      .orderBy('attendance_records.record_date', 'desc');
    if (wing_id)     q = q.where('resources.business_wing_id', wing_id);
    if (resource_id) q = q.where('attendance_records.resource_id', resource_id);
    if (status)      q = q.where('attendance_records.status', status);
    if (from)        q = q.where('attendance_records.record_date', '>=', from);
    if (to)          q = q.where('attendance_records.record_date', '<=', to);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { resource_id, record_date, status, leave_type, check_in, check_out, notes } = req.body;
    if (!resource_id || !record_date || !status) {
      return res.status(400).json({ error: 'resource_id, record_date, status required' });
    }
    const [row] = await db('attendance_records').insert({
      resource_id, record_date, status, leave_type, check_in, check_out, notes,
    }).returning('*');
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Attendance already recorded for this date' });
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { status, leave_type, check_in, check_out, notes } = req.body;
    const [row] = await db('attendance_records').where({ id: req.params.id })
      .update({ status, leave_type, check_in, check_out, notes })
      .returning('*');
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const n = await db('attendance_records').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /leave-balances — must stay AFTER specific named routes ──────────────
router.get('/leave-balances', async (req, res) => {
  try {
    const { resource_id, year } = req.query;
    let q = db('leave_balances')
      .join('resources', 'resources.id', 'leave_balances.resource_id')
      .select('leave_balances.*', 'resources.full_name as resource_name');
    if (resource_id) q = q.where('leave_balances.resource_id', resource_id);
    if (year)        q = q.where('leave_balances.year', year);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

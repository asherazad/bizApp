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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToMins(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}

function isWeekday(dateStr) {
  const day = new Date(dateStr + 'T00:00:00').getDay(); // local midnight avoids UTC shift
  return day !== 0 && day !== 6; // 0=Sun, 6=Sat
}

// Enumerate all weekday dates between two ISO date strings (inclusive)
function weekdaysBetween(from, to) {
  const days = [];
  const cur  = new Date(from + 'T00:00:00');
  const end  = new Date(to   + 'T00:00:00');
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── POST /import — biometric Excel ──────────────────────────────────────────
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'An Excel file (.xlsx / .xls) is required' });

    const wb   = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) return res.status(400).json({ error: 'Sheet is empty or has no data rows' });

    // ── 1. Build resource lookup (one query) ──────────────────────────────────
    const allResources = await db('resources')
      .whereNotNull('resource_seq_id')
      .select('id', 'resource_seq_id', 'full_name');
    const resourceMap = {};
    for (const r of allResources) resourceMap[parseInt(r.resource_seq_id)] = r;

    // ── 2. Parse and group punches ────────────────────────────────────────────
    const grouped = {}; // key: "seqId_date"
    const unknownIds = new Set();

    for (const row of rows) {
      const rawId = row['No.'] ?? row['No'] ?? row['ID'] ?? '';
      const rawDt = row['Date/Time'] ?? row['DateTime'] ?? row['Time'] ?? row['date_time'] ?? '';
      const seqId = parseInt(rawId);
      if (!seqId || !rawDt) continue;

      const dt = parseBiometricDateTime(rawDt);
      if (!dt) continue;

      const date = dt.toISOString().split('T')[0];
      const pad  = n => String(n).padStart(2, '0');
      const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

      if (!resourceMap[seqId]) { unknownIds.add(seqId); continue; }

      const key = `${seqId}_${date}`;
      if (!grouped[key]) grouped[key] = { seqId, date, times: [] };
      grouped[key].times.push(time);
    }

    const entries = Object.values(grouped);
    if (!entries.length) {
      return res.status(400).json({
        error: `No valid punch records found. Verify "No." and "Date/Time" columns exist.${unknownIds.size ? ` Unknown IDs: ${[...unknownIds].slice(0,5).join(', ')}` : ''}`,
      });
    }

    // ── 3. Determine check_in / check_out / status per day ───────────────────
    const processed = []; // { resource_id, date, check_in, check_out, status }
    for (const entry of entries) {
      const resource = resourceMap[entry.seqId];
      entry.times.sort();
      const check_in  = entry.times[0];
      const check_out = entry.times.length > 1 ? entry.times[entry.times.length - 1] : null;

      // present ≥8h | short_hours <8h | half_day = no checkout
      let status;
      if (!check_out) {
        status = 'half_day';
      } else {
        const worked = timeToMins(check_out) - timeToMins(check_in);
        status = worked >= 8 * 60 ? 'present' : 'short_hours';
      }

      processed.push({ resource_id: resource.id, record_date: entry.date, check_in, check_out, status });
    }

    // ── 4. Fetch all existing records in ONE query ────────────────────────────
    const resourceIds  = [...new Set(processed.map(p => p.resource_id))];
    const dates        = [...new Set(processed.map(p => p.record_date))];
    const existingRows = await db('attendance_records')
      .whereIn('resource_id', resourceIds)
      .whereIn('record_date', dates)
      .select('id', 'resource_id', 'record_date');

    const existingMap = {};
    for (const r of existingRows) existingMap[`${r.resource_id}_${r.record_date}`] = r.id;

    // ── 5. Skip existing records — only insert truly new ones ─────────────────
    const toInsert = [];
    const skipped  = [];
    for (const p of processed) {
      const key = `${p.resource_id}_${p.record_date}`;
      if (existingMap[key]) skipped.push(key);
      else                  toInsert.push(p);
    }

    // ── 6. Bulk insert new records only ───────────────────────────────────────
    if (toInsert.length)
      await db('attendance_records').insert(toInsert)
        .onConflict(['resource_id', 'record_date']).ignore();

    // ── 7. Auto-mark leave for weekdays with no punch ─────────────────────────
    // For each resource that appeared in the import, any weekday in the import
    // date range with no punch record gets a 'leave' record.
    const minDate = dates.reduce((a, b) => a < b ? a : b);
    const maxDate = dates.reduce((a, b) => a > b ? a : b);
    const allWeekdays = weekdaysBetween(minDate, maxDate);

    // Build set of (resource_id, date) already handled
    const handledKeys = new Set([...processed.map(p => `${p.resource_id}_${p.record_date}`)]);

    // Fetch any leave records that already exist to avoid duplicates
    const existingLeave = await db('attendance_records')
      .whereIn('resource_id', resourceIds)
      .whereIn('record_date', allWeekdays)
      .select('resource_id', 'record_date');
    for (const r of existingLeave) handledKeys.add(`${r.resource_id}_${r.record_date}`);

    const leaveRows = [];
    for (const rid of resourceIds) {
      for (const d of allWeekdays) {
        if (!handledKeys.has(`${rid}_${d}`)) {
          leaveRows.push({ resource_id: rid, record_date: d, status: 'absent' });
        }
      }
    }
    if (leaveRows.length)
      await db('attendance_records').insert(leaveRows)
        .onConflict(['resource_id', 'record_date']).ignore();

    res.json({
      message: `Import complete — ${toInsert.length} added, ${skipped.length} duplicate${skipped.length !== 1 ? 's' : ''} skipped, ${leaveRows.length} absent days marked${unknownIds.size ? `, ${unknownIds.size} unknown IDs skipped` : ''}`,
      inserted: toInsert.length,
      skipped:  skipped.length,
      leave:    leaveRows.length,
    });
  } catch (err) {
    console.error('POST /attendance/import', err);
    res.status(500).json({ error: 'Server error', detail: String(err.message) });
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

// ─── POST /migrate-statuses — one-time migration to new status scheme ────────
router.post('/migrate-statuses', async (req, res) => {
  try {
    // half_day with both times → short_hours (<8h) or present (≥8h)
    // check_in/check_out are TIME columns; subtract gives interval, epoch gives seconds
    const r1 = await db.raw(`
      UPDATE attendance_records
      SET status = CASE
        WHEN EXTRACT(EPOCH FROM (check_out - check_in)) / 60 >= 480 THEN 'present'
        ELSE 'short_hours'
      END
      WHERE status    = 'half_day'
        AND check_in  IS NOT NULL
        AND check_out IS NOT NULL
    `);

    // leave with no punch → absent
    const r2 = await db.raw(`
      UPDATE attendance_records
      SET status = 'absent'
      WHERE status   = 'leave'
        AND check_in  IS NULL
        AND check_out IS NULL
    `);

    res.json({
      message: `Migration complete — ${r1.rowCount} half_day records reclassified, ${r2.rowCount} leave records marked absent`,
      half_day_reclassified: r1.rowCount,
      leave_to_absent:       r2.rowCount,
    });
  } catch (err) {
    console.error('POST /attendance/migrate-statuses', err);
    res.status(500).json({ error: 'Migration failed', detail: err.message });
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

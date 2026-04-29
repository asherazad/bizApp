const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

function calcNet(row) {
  return Math.max(0,
    (parseFloat(row.gross_salary)      || 0)
    + (parseFloat(row.overtime_amount) || 0)
    - (parseFloat(row.tax_deduction)   || 0)
    - (parseFloat(row.loan_deduction)  || 0)
    - (parseFloat(row.advance_deduction) || 0)
    - (parseFloat(row.other_deductions)  || 0)
  );
}

// ─── GET /preview  — payroll preview for a month (must precede /:id) ─────────
router.get('/preview', async (req, res) => {
  try {
    const { wing_id, month_year } = req.query;
    if (!month_year) return res.status(400).json({ error: 'month_year is required (YYYY-MM)' });

    let q = db('resources as r')
      .leftJoin('business_wings as bw', 'bw.id', 'r.business_wing_id')
      .select('r.id', 'r.full_name', 'r.designation', 'r.employment_status',
              'r.account_number', 'r.bank_name', 'r.gross_salary', 'r.tax_amount',
              'r.allowance_amount',
              'bw.id as wing_id', 'bw.name as wing_name')
      .whereNotNull('r.full_name')
      .whereNotIn(db.raw("LOWER(COALESCE(r.employment_status,''))"), ['resigned', 'terminated'])
      .orderByRaw('r.resource_seq_id ASC NULLS LAST, r.full_name ASC');

    if (wing_id) q = q.where('r.business_wing_id', wing_id);

    const resources = await q;
    if (!resources.length) return res.json([]);

    const ids = resources.map(r => r.id);

    const [loans, existing] = await Promise.all([
      db('loan_records')
        .whereIn('resource_id', ids)
        .where('status', 'active')
        .where('monthly_installment', '>', 0)
        .select('resource_id', db.raw('SUM(monthly_installment) as total'))
        .groupBy('resource_id'),
      db('payroll_runs')
        .where('month_year', month_year)
        .whereIn('resource_id', ids)
        .select('*'),
    ]);

    const loanMap = Object.fromEntries(loans.map(l => [l.resource_id, parseFloat(l.total) || 0]));
    const runMap  = Object.fromEntries(existing.map(r => [r.resource_id, r]));

    const preview = resources.map(r => {
      const ex        = runMap[r.id];
      const gross     = parseFloat(r.gross_salary)    || 0;
      const allowance = parseFloat(r.allowance_amount)|| 0;
      const tax       = parseFloat(r.tax_amount)      || 0;
      const loan      = loanMap[r.id] || 0;
      const effectiveGross = gross + allowance;
      return {
        resource_id:       r.id,
        resource_name:     r.full_name,
        designation:       r.designation,
        employment_status: r.employment_status,
        account_number:    r.account_number,
        bank_name:         r.bank_name,
        wing_name:         r.wing_name,
        allowance_amount:  allowance,
        gross_salary:      ex ? parseFloat(ex.gross_salary)      : effectiveGross,
        tax_deduction:     ex ? parseFloat(ex.tax_deduction)     : tax,
        loan_deduction:    ex ? parseFloat(ex.loan_deduction)    : loan,
        advance_deduction: ex ? parseFloat(ex.advance_deduction) : 0,
        other_deductions:  ex ? parseFloat(ex.other_deductions)  : 0,
        overtime_amount:   ex ? parseFloat(ex.overtime_amount)   : 0,
        net_salary:        ex ? parseFloat(ex.net_salary) : Math.max(0, effectiveGross - tax - loan),
        payroll_run_id:    ex?.id  || null,
        status:            ex?.status || null,
      };
    });

    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /batch  — upsert payroll for all resources in a month ───────────────
router.post('/batch', async (req, res) => {
  try {
    const { wing_id, month_year, rows } = req.body;
    if (!month_year || !Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'month_year and rows[] required' });
    }

    await db.transaction(async trx => {
      for (const row of rows) {
        const gross = parseFloat(row.gross_salary) || 0;
        const net   = calcNet(row);
        const payload = {
          resource_id:       row.resource_id,
          business_wing_id:  wing_id || null,
          month_year,
          working_days:      26,
          present_days:      26,
          gross_salary:      gross,
          basic_earned:      gross,
          allowances_earned: 0,
          overtime_hours:    0,
          overtime_rate:     0,
          overtime_amount:   parseFloat(row.overtime_amount)   || 0,
          tax_deduction:     parseFloat(row.tax_deduction)     || 0,
          loan_deduction:    parseFloat(row.loan_deduction)    || 0,
          advance_deduction: parseFloat(row.advance_deduction) || 0,
          other_deductions:  parseFloat(row.other_deductions)  || 0,
          net_salary:        net,
          status:            'paid',
        };
        if (row.payroll_run_id) {
          await trx('payroll_runs').where({ id: row.payroll_run_id }).update(payload);
        } else {
          await trx('payroll_runs').insert(payload);
        }
      }
    });

    res.json({ message: 'Payroll processed', count: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /  — list runs ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, resource_id, month_year, status } = req.query;
    let q = db('payroll_runs as p')
      .join('resources as r', 'r.id', 'p.resource_id')
      .leftJoin('business_wings as bw', 'bw.id', 'p.business_wing_id')
      .select('p.*', 'r.full_name as resource_name', 'bw.name as wing_name')
      .orderBy('p.created_at', 'desc');
    if (wing_id)    q = q.where('p.business_wing_id', wing_id);
    if (resource_id) q = q.where('p.resource_id', resource_id);
    if (month_year)  q = q.where('p.month_year', month_year);
    if (status)      q = q.where('p.status', status);
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /:id ──────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const run = await db('payroll_runs as p')
      .join('resources as r', 'r.id', 'p.resource_id')
      .leftJoin('business_wings as bw', 'bw.id', 'p.business_wing_id')
      .where('p.id', req.params.id)
      .select('p.*', 'r.full_name as resource_name', 'bw.name as wing_name')
      .first();
    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id ──────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['status', 'payment_date', 'notes',
      'gross_salary', 'tax_deduction', 'loan_deduction',
      'advance_deduction', 'other_deductions', 'overtime_amount', 'net_salary'];
    const update = Object.fromEntries(allowed.filter(k => k in req.body).map(k => [k, req.body[k]]));
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update' });
    const [run] = await db('payroll_runs').where({ id: req.params.id }).update(update).returning('*');
    if (!run) return res.status(404).json({ error: 'Not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const n = await db('payroll_runs').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

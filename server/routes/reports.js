const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── helpers ─────────────────────────────────────────────────────────────────
function toMap(rows, key, valKey) {
  const m = {};
  for (const r of rows) m[r[key]] = parseFloat(r[valKey]) || 0;
  return m;
}

// Build running 6-month date range ending today
function last6MonthsRange() {
  const now  = new Date();
  const to   = now.toISOString().split('T')[0];
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from  = start.toISOString().split('T')[0];
  return { from, to };
}

function toYYYYMM(dateStr) { return dateStr.slice(0, 7); }

// ─── GET /summary ─────────────────────────────────────────────────────────────
// Wing P&L: Revenue, Payroll, Operating, Tax Provision, Net Profit, Margin%
router.get('/summary', async (req, res) => {
  try {
    let { from, to, wing_id } = req.query;

    if (!from || !to) {
      const now = new Date();
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    const fromM = toYYYYMM(from);
    const toM   = toYYYYMM(to);

    // All wings (or a specific one)
    let wingsQ = db('business_wings').select('id', 'name', 'code').orderBy('name');
    if (wing_id) wingsQ = wingsQ.where('id', wing_id);
    const wings = await wingsQ;

    // ── Revenue: single-wing invoices ─────────────────────────────────────────
    let singleQ = db('invoices')
      .where('status', 'Received')
      .where(function () {
        this.where('wing_assignment_mode', 'single').orWhereNull('wing_assignment_mode');
      })
      .where(db.raw(`COALESCE(received_date, invoice_date) >= ?`, [from]))
      .where(db.raw(`COALESCE(received_date, invoice_date) <= ?`, [to]))
      .select('business_wing_id')
      .sum('pkr_equivalent as revenue')
      .groupBy('business_wing_id');
    if (wing_id) singleQ = singleQ.where('business_wing_id', wing_id);

    // ── Revenue: split/line_item invoices ─────────────────────────────────────
    let splitQ = db('invoice_wing_splits as s')
      .join('invoices as i', 'i.id', 's.invoice_id')
      .where('i.status', 'Received')
      .whereIn('i.wing_assignment_mode', ['split', 'line_item'])
      .where(db.raw(`COALESCE(i.received_date, i.invoice_date) >= ?`, [from]))
      .where(db.raw(`COALESCE(i.received_date, i.invoice_date) <= ?`, [to]))
      .select('s.business_wing_id')
      .sum('s.pkr_equivalent as revenue')
      .groupBy('s.business_wing_id');
    if (wing_id) splitQ = splitQ.where('s.business_wing_id', wing_id);

    // ── Payroll cost ──────────────────────────────────────────────────────────
    let payrollQ = db('payroll_runs as pr')
      .join('resources as r', 'r.id', 'pr.resource_id')
      .where('pr.status', 'paid')
      .where('pr.month_year', '>=', fromM)
      .where('pr.month_year', '<=', toM)
      .select('r.business_wing_id')
      .sum('pr.net_salary as payroll_cost')
      .groupBy('r.business_wing_id');
    if (wing_id) payrollQ = payrollQ.where('r.business_wing_id', wing_id);

    // ── Operating cost (bank debits excluding payroll and transfers) ──────────
    let opQ = db('bank_transactions')
      .where('txn_type', 'Debit')
      .where(function () {
        this.whereNull('reference_type')
          .orWhereNotIn('reference_type', ['transfer', 'payroll', 'reversal']);
      })
      .where('txn_date', '>=', from)
      .where('txn_date', '<=', to)
      .whereNotNull('business_wing_id')
      .select('business_wing_id')
      .sum('amount as operating_cost')
      .groupBy('business_wing_id');
    if (wing_id) opQ = opQ.where('business_wing_id', wing_id);

    // ── Tax provision (all outstanding challans — standing liability) ─────────
    let taxQ = db('tax_challans')
      .whereIn('status', ['pending', 'overdue'])
      .select('business_wing_id')
      .sum('amount_due as tax_provision')
      .groupBy('business_wing_id');
    if (wing_id) taxQ = taxQ.where('business_wing_id', wing_id);

    const [singleRev, splitRev, payroll, operating, tax] = await Promise.all([
      singleQ, splitQ, payrollQ, opQ, taxQ,
    ]);

    const singleMap  = toMap(singleRev, 'business_wing_id', 'revenue');
    const splitMap   = toMap(splitRev,  'business_wing_id', 'revenue');
    const payrollMap = toMap(payroll,   'business_wing_id', 'payroll_cost');
    const opMap      = toMap(operating, 'business_wing_id', 'operating_cost');
    const taxMap     = toMap(tax,       'business_wing_id', 'tax_provision');

    const rows = wings.map(w => {
      const revenue        = (singleMap[w.id] || 0) + (splitMap[w.id] || 0);
      const payroll_cost   = payrollMap[w.id] || 0;
      const operating_cost = opMap[w.id] || 0;
      const tax_provision  = taxMap[w.id] || 0;
      const total_cost     = payroll_cost + operating_cost;
      const net_profit     = revenue - total_cost - tax_provision;
      const margin_pct     = revenue > 0 ? parseFloat((net_profit / revenue * 100).toFixed(1)) : 0;
      return {
        wing_id: w.id, wing_name: w.name, wing_code: w.code,
        revenue, payroll_cost, operating_cost, tax_provision,
        total_cost, net_profit, margin_pct,
      };
    });

    res.json({ from, to, wings: rows });
  } catch (err) {
    console.error('GET /reports/summary', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /trend ───────────────────────────────────────────────────────────────
// Last 6 months of monthly Revenue vs Costs, optionally per wing
router.get('/trend', async (req, res) => {
  try {
    const { wing_id } = req.query;
    const { from, to } = last6MonthsRange();
    const fromM = toYYYYMM(from);
    const toM   = toYYYYMM(to);

    // Revenue (single) by month
    let r1Q = db('invoices')
      .where('status', 'Received')
      .where(function () {
        this.where('wing_assignment_mode', 'single').orWhereNull('wing_assignment_mode');
      })
      .where(db.raw(`COALESCE(received_date, invoice_date) >= ?`, [from]))
      .where(db.raw(`COALESCE(received_date, invoice_date) <= ?`, [to]))
      .select(db.raw(`TO_CHAR(COALESCE(received_date, invoice_date), 'YYYY-MM') as month`))
      .sum('pkr_equivalent as revenue')
      .groupByRaw(`TO_CHAR(COALESCE(received_date, invoice_date), 'YYYY-MM')`);
    if (wing_id) r1Q = r1Q.where('business_wing_id', wing_id);

    // Revenue (split/line_item) by month
    let r2Q = db('invoice_wing_splits as s')
      .join('invoices as i', 'i.id', 's.invoice_id')
      .where('i.status', 'Received')
      .whereIn('i.wing_assignment_mode', ['split', 'line_item'])
      .where(db.raw(`COALESCE(i.received_date, i.invoice_date) >= ?`, [from]))
      .where(db.raw(`COALESCE(i.received_date, i.invoice_date) <= ?`, [to]))
      .select(db.raw(`TO_CHAR(COALESCE(i.received_date, i.invoice_date), 'YYYY-MM') as month`))
      .sum('s.pkr_equivalent as revenue')
      .groupByRaw(`TO_CHAR(COALESCE(i.received_date, i.invoice_date), 'YYYY-MM')`);
    if (wing_id) r2Q = r2Q.where('s.business_wing_id', wing_id);

    // Payroll by month
    let payQ = db('payroll_runs as pr')
      .join('resources as r', 'r.id', 'pr.resource_id')
      .where('pr.status', 'paid')
      .where('pr.month_year', '>=', fromM)
      .where('pr.month_year', '<=', toM)
      .select('pr.month_year as month')
      .sum('pr.net_salary as payroll_cost')
      .groupBy('pr.month_year');
    if (wing_id) payQ = payQ.where('r.business_wing_id', wing_id);

    // Operating by month
    let opQ = db('bank_transactions')
      .where('txn_type', 'Debit')
      .where(function () {
        this.whereNull('reference_type')
          .orWhereNotIn('reference_type', ['transfer', 'payroll', 'reversal']);
      })
      .where('txn_date', '>=', from)
      .where('txn_date', '<=', to)
      .whereNotNull('business_wing_id')
      .select(db.raw(`TO_CHAR(txn_date, 'YYYY-MM') as month`))
      .sum('amount as operating_cost')
      .groupByRaw(`TO_CHAR(txn_date, 'YYYY-MM')`);
    if (wing_id) opQ = opQ.where('business_wing_id', wing_id);

    const [r1, r2, payroll, operating] = await Promise.all([r1Q, r2Q, payQ, opQ]);

    // Build month-keyed map (ensure all 6 months appear even with zero data)
    const months = {};
    const cur = new Date(from.slice(0, 7) + '-01');
    const end = new Date(to.slice(0, 7) + '-01');
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 7);
      months[key] = { month: key, revenue: 0, payroll_cost: 0, operating_cost: 0 };
      cur.setMonth(cur.getMonth() + 1);
    }

    for (const r of r1)      if (months[r.month]) months[r.month].revenue        += parseFloat(r.revenue) || 0;
    for (const r of r2)      if (months[r.month]) months[r.month].revenue        += parseFloat(r.revenue) || 0;
    for (const r of payroll)  if (months[r.month]) months[r.month].payroll_cost  += parseFloat(r.payroll_cost) || 0;
    for (const r of operating) if (months[r.month]) months[r.month].operating_cost += parseFloat(r.operating_cost) || 0;

    const trend = Object.values(months).map(m => ({
      ...m,
      net_profit: m.revenue - m.payroll_cost - m.operating_cost,
    }));

    res.json(trend);
  } catch (err) {
    console.error('GET /reports/trend', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /receivables ─────────────────────────────────────────────────────────
// Outstanding invoices bucketed by days overdue
router.get('/receivables', async (req, res) => {
  try {
    const { wing_id } = req.query;

    let q = db('invoices as i')
      .leftJoin('business_wings as bw', 'bw.id', 'i.business_wing_id')
      .where('i.status', 'Pending')
      .select(
        'i.id', 'i.invoice_number', 'i.client_name', 'i.invoice_date',
        'i.due_date', 'i.pkr_equivalent', 'i.currency', 'i.total_amount',
        'i.business_wing_id', 'bw.name as wing_name',
      )
      .orderBy('i.invoice_date', 'asc');
    if (wing_id) q = q.where('i.business_wing_id', wing_id);

    const invoices = await q;
    const today    = new Date();

    const buckets  = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };

    for (const inv of invoices) {
      const ref  = inv.due_date || inv.invoice_date;
      const days = ref ? Math.floor((today - new Date(ref)) / (1000 * 60 * 60 * 24)) : 0;
      inv.days_overdue = Math.max(0, days);
      if      (days <= 30) buckets['0-30'].push(inv);
      else if (days <= 60) buckets['31-60'].push(inv);
      else if (days <= 90) buckets['61-90'].push(inv);
      else                 buckets['90+'].push(inv);
    }

    const summary = Object.entries(buckets).map(([bucket, items]) => ({
      bucket,
      count:  items.length,
      total:  items.reduce((s, i) => s + (parseFloat(i.pkr_equivalent) || 0), 0),
      items,
    }));

    res.json({ total_outstanding: invoices.reduce((s, i) => s + (parseFloat(i.pkr_equivalent) || 0), 0), summary });
  } catch (err) {
    console.error('GET /reports/receivables', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── GET /po-pipeline ─────────────────────────────────────────────────────────
// Active POs with remaining value and burn rate
router.get('/po-pipeline', async (req, res) => {
  try {
    const { wing_id } = req.query;

    let q = db('purchase_orders as po')
      .leftJoin('business_wings as bw', 'bw.id', 'po.business_wing_id')
      .leftJoin('clients as cl', 'cl.id', 'po.client_id')
      .where('po.status', 'active')
      .select(
        'po.id', 'po.po_number', 'po.po_value', 'po.currency',
        'po.issue_date', 'po.expiry_date', 'po.business_wing_id',
        'bw.name as wing_name', 'cl.name as client_name',
        db.raw(`COALESCE((
          SELECT SUM(total_amount) FROM invoices
          WHERE invoices.po_id = po.id
        ), 0) as invoiced_amount`),
      )
      .orderBy('po.issue_date', 'asc');

    if (wing_id) q = q.where('po.business_wing_id', wing_id);

    const pos = await q;
    const today = new Date();

    const enriched = pos.map(po => {
      const total     = parseFloat(po.po_value)       || 0;
      const invoiced  = parseFloat(po.invoiced_amount) || 0;
      const remaining = Math.max(0, total - invoiced);
      const pct_used  = total > 0 ? parseFloat(((invoiced / total) * 100).toFixed(1)) : 0;

      // Days since issue to today (for burn rate)
      const issue   = po.issue_date ? new Date(po.issue_date) : today;
      const elapsed = Math.max(1, Math.floor((today - issue) / (1000 * 60 * 60 * 24)));
      const daily_burn = invoiced / elapsed;

      // Projected exhaustion date
      let projected_end = null;
      if (daily_burn > 0 && remaining > 0) {
        const daysLeft = Math.ceil(remaining / daily_burn);
        const projDate = new Date(today);
        projDate.setDate(projDate.getDate() + daysLeft);
        projected_end = projDate.toISOString().split('T')[0];
      }

      return { ...po, remaining, pct_used, projected_end };
    });

    res.json(enriched);
  } catch (err) {
    console.error('GET /reports/po-pipeline', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

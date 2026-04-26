const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id } = req.query;
    const wingFilter = (table) => wing_id ? (q) => q.where(`${table}.wing_id`, wing_id) : (q) => q;

    const [
      invoiceSummary,
      poSummary,
      bankBalances,
      pendingTax,
      upcomingReminders,
      upcomingSubs,
      recentTransactions,
    ] = await Promise.all([
      // Invoice summary
      db('invoices')
        .modify(wingFilter('invoices'))
        .select(
          db.raw('COUNT(*) as total_count'),
          db.raw("SUM(CASE WHEN status NOT IN ('fully_paid','cancelled') THEN pkr_total - paid_amount * exchange_rate ELSE 0 END) as outstanding_pkr"),
          db.raw("SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count"),
        ).first(),

      // PO summary
      db('purchase_orders')
        .modify(wingFilter('purchase_orders'))
        .select(
          db.raw('COUNT(*) as total_count'),
          db.raw("SUM(pkr_total - invoiced_amount) as remaining_pkr"),
        ).first(),

      // Bank balances
      db('bank_accounts')
        .modify(wingFilter('bank_accounts'))
        .where('is_active', true)
        .select('bank_name', 'account_title', 'current_balance', 'currency_code'),

      // Pending tax challans
      db('tax_challans')
        .modify(wingFilter('tax_challans'))
        .where('status', 'pending')
        .count('* as count')
        .sum('tax_amount as total_due')
        .first(),

      // Upcoming reminders (7 days)
      db('reminders')
        .modify(wing_id ? (q) => q.where('wing_id', wing_id) : (q) => q)
        .where('is_completed', false)
        .where('due_at', '<=', db.raw("NOW() + INTERVAL '7 days'"))
        .orderBy('due_at')
        .limit(5),

      // Upcoming subscriptions (30 days)
      db('subscriptions')
        .modify(wingFilter('subscriptions'))
        .where('is_active', true)
        .where('next_billing_date', '<=', db.raw("CURRENT_DATE + INTERVAL '30 days'"))
        .orderBy('next_billing_date')
        .limit(5),

      // Recent transactions
      db('bank_transactions')
        .modify(wingFilter('bank_transactions'))
        .join('bank_accounts', 'bank_accounts.id', 'bank_transactions.bank_account_id')
        .select('bank_transactions.*', 'bank_accounts.bank_name')
        .orderBy('bank_transactions.transaction_date', 'desc')
        .limit(10),
    ]);

    res.json({
      invoices: invoiceSummary,
      purchase_orders: poSummary,
      bank_balances: bankBalances,
      pending_tax: pendingTax,
      upcoming_reminders: upcomingReminders,
      upcoming_subscriptions: upcomingSubs,
      recent_transactions: recentTransactions,
    });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

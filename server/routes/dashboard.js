const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { wing_id } = req.query;
    const wf = (table) => (q) => { if (wing_id) q.where(`${table}.business_wing_id`, wing_id); };

    const [
      invoiceSummary,
      poSummary,
      bankBalances,
      pendingTax,
      upcomingReminders,
      upcomingSubs,
      recentTransactions,
      pendingBills,
    ] = await Promise.all([
      // Invoice summary
      db('invoices').modify(wf('invoices'))
        .select(
          db.raw('COUNT(*) as total_count'),
          db.raw("SUM(CASE WHEN status IN ('Pending','Overdue') THEN pkr_equivalent ELSE 0 END) as outstanding_pkr"),
          db.raw("SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) as overdue_count"),
          db.raw("SUM(CASE WHEN status = 'Received' THEN 1 ELSE 0 END) as received_count"),
        ).first(),

      // PO summary — remaining = po_value minus already-invoiced amounts
      db('purchase_orders').modify(wf('purchase_orders'))
        .select(
          db.raw('COUNT(*) as total_count'),
          db.raw(`SUM(po_value - COALESCE(
            (SELECT SUM(i.total_amount) FROM invoices i WHERE i.po_id = purchase_orders.id), 0
          )) as remaining_value`),
          db.raw(`SUM(
            pkr_equivalent - COALESCE(
              (SELECT SUM(i.total_amount) FROM invoices i WHERE i.po_id = purchase_orders.id), 0
            ) * exchange_rate
          ) as remaining_pkr`),
          db.raw("mode() WITHIN GROUP (ORDER BY currency) as currency"),
          db.raw("SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_count"),
        ).first(),

      // Bank balances
      db('bank_accounts').modify(wf('bank_accounts'))
        .where('is_active', true)
        .select('bank_name', 'account_title', 'current_balance', 'currency', 'business_wing_id'),

      // Pending tax challans
      db('tax_challans').modify(wf('tax_challans'))
        .whereIn('status', ['Pending', 'Overdue'])
        .select(db.raw('COUNT(*) as count'), db.raw('SUM(amount_due) as total_due'))
        .first(),

      // Upcoming reminders (7 days)
      db('reminders').modify((q) => { if (wing_id) q.where('business_wing_id', wing_id); })
        .where('status', 'Active')
        .where('reminder_date', '<=', db.raw("CURRENT_DATE + INTERVAL '7 days'"))
        .orderBy('reminder_date').limit(5),

      // Upcoming subscriptions (30 days)
      db('subscriptions').modify(wf('subscriptions'))
        .where('status', 'Active')
        .where('next_renewal_date', '<=', db.raw("CURRENT_DATE + INTERVAL '30 days'"))
        .orderBy('next_renewal_date').limit(5),

      // Recent bank transactions
      db('bank_transactions').modify(wf('bank_transactions'))
        .join('bank_accounts', 'bank_accounts.id', 'bank_transactions.bank_account_id')
        .select('bank_transactions.*', 'bank_accounts.bank_name')
        .orderBy('bank_transactions.txn_date', 'desc').limit(8),

      // Pending bills
      db('bill_payments').modify(wf('bill_payments'))
        .whereIn('status', ['Pending', 'Overdue'])
        .select(db.raw('COUNT(*) as count'), db.raw('SUM(amount) as total_due'))
        .first(),
    ]);

    res.json({
      invoices:              invoiceSummary,
      purchase_orders:       poSummary,
      bank_balances:         bankBalances,
      pending_tax:           pendingTax,
      pending_bills:         pendingBills,
      upcoming_reminders:    upcomingReminders,
      upcoming_subscriptions: upcomingSubs,
      recent_transactions:   recentTransactions,
    });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

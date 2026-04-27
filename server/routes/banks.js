const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── Bank Accounts ────────────────────────────────────────────────────────────

router.get('/accounts', async (req, res) => {
  try {
    const { wing_id } = req.query;
    let q = db('bank_accounts')
      .leftJoin('business_wings', 'business_wings.id', 'bank_accounts.business_wing_id')
      .select('bank_accounts.*', 'business_wings.name as wing_name')
      .orderBy('bank_accounts.bank_name');
    if (wing_id) q = q.where('bank_accounts.business_wing_id', wing_id);
    res.json(await q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.get('/accounts/:id', async (req, res) => {
  try {
    const account = await db('bank_accounts').where({ id: req.params.id }).first();
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const { wing_id, bank_name, account_number_last4, account_title, currency, opening_balance, is_shared } = req.body;
    if (!wing_id || !bank_name || !account_title) {
      return res.status(400).json({ error: 'wing_id, bank_name, and account_title are required' });
    }
    const balance = parseFloat(opening_balance) || 0;
    const [account] = await db('bank_accounts').insert({
      business_wing_id: wing_id,
      bank_name, account_number_last4, account_title,
      currency: currency || 'PKR',
      current_balance: balance,
      is_shared: is_shared || false,
    }).returning('*');
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.put('/accounts/:id', async (req, res) => {
  try {
    const { bank_name, account_title, is_active, is_shared } = req.body;
    const [account] = await db('bank_accounts').where({ id: req.params.id })
      .update({ bank_name, account_title, is_active, is_shared })
      .returning('*');
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get('/transactions', async (req, res) => {
  try {
    const { wing_id, bank_account_id, from, to, txn_type, limit = 100, offset = 0 } = req.query;
    let q = db('bank_transactions')
      .join('bank_accounts', 'bank_accounts.id', 'bank_transactions.bank_account_id')
      .select('bank_transactions.*', 'bank_accounts.bank_name', 'bank_accounts.account_number_last4')
      .orderBy('bank_transactions.txn_date', 'desc')
      .limit(parseInt(limit)).offset(parseInt(offset));
    if (wing_id)         q = q.where('bank_transactions.business_wing_id', wing_id);
    if (bank_account_id) q = q.where('bank_transactions.bank_account_id', bank_account_id);
    if (txn_type)        q = q.where('bank_transactions.txn_type', txn_type);
    if (from)            q = q.where('bank_transactions.txn_date', '>=', from);
    if (to)              q = q.where('bank_transactions.txn_date', '<=', to);
    res.json(await q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/transactions', async (req, res) => {
  try {
    const { bank_account_id, wing_id, txn_type, amount, currency, description, reference_type, reference_id, txn_date } = req.body;
    if (!bank_account_id || !wing_id || !txn_type || !amount || !description || !txn_date) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const amt = parseFloat(amount);
    const account = await db('bank_accounts').where({ id: bank_account_id }).first();
    if (!account) return res.status(404).json({ error: 'Bank account not found' });

    const newBalance = txn_type === 'Credit'
      ? parseFloat(account.current_balance) + amt
      : parseFloat(account.current_balance) - amt;

    const [txn] = await db.transaction(async (trx) => {
      const inserted = await trx('bank_transactions').insert({
        bank_account_id,
        business_wing_id: wing_id,
        txn_type, amount: amt,
        currency: currency || account.currency || 'PKR',
        description, reference_type, reference_id, txn_date,
        running_balance: newBalance,
      }).returning('*');
      await trx('bank_accounts').where({ id: bank_account_id })
        .update({ current_balance: newBalance });
      return inserted;
    });

    res.status(201).json(txn);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const txn = await db('bank_transactions').where({ id: req.params.id }).first();
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const reversal = txn.txn_type === 'Credit' ? -txn.amount : txn.amount;
    await db.transaction(async (trx) => {
      await trx('bank_accounts').where({ id: txn.bank_account_id })
        .increment('current_balance', reversal);
      await trx('bank_transactions').where({ id: req.params.id }).delete();
    });
    res.json({ message: 'Deleted and balance reversed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── Bank Accounts ────────────────────────────────────────────────────────────

router.get('/accounts', async (req, res) => {
  try {
    const { wing_id } = req.query;
    let q = db('bank_accounts')
      .join('business_wings', 'business_wings.id', 'bank_accounts.wing_id')
      .select('bank_accounts.*', 'business_wings.name as wing_name')
      .orderBy('bank_accounts.bank_name');
    if (wing_id) q = q.where('bank_accounts.wing_id', wing_id);
    res.json(await q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
    const { wing_id, bank_name, account_number, account_title, branch, iban, currency_code, opening_balance } = req.body;
    if (!wing_id || !bank_name || !account_number || !account_title) {
      return res.status(400).json({ error: 'wing_id, bank_name, account_number, and account_title are required' });
    }
    const balance = parseFloat(opening_balance) || 0;
    const [account] = await db('bank_accounts').insert({
      wing_id, bank_name, account_number, account_title, branch, iban,
      currency_code: currency_code || 'PKR',
      opening_balance: balance,
      current_balance: balance,
    }).returning('*');
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/accounts/:id', async (req, res) => {
  try {
    const { bank_name, account_title, branch, iban, is_active } = req.body;
    const [account] = await db('bank_accounts').where({ id: req.params.id })
      .update({ bank_name, account_title, branch, iban, is_active, updated_at: new Date() })
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
    const { wing_id, bank_account_id, from, to, type, limit = 100, offset = 0 } = req.query;
    let q = db('bank_transactions')
      .join('bank_accounts', 'bank_accounts.id', 'bank_transactions.bank_account_id')
      .select('bank_transactions.*', 'bank_accounts.bank_name', 'bank_accounts.account_number')
      .orderBy('bank_transactions.transaction_date', 'desc')
      .limit(parseInt(limit)).offset(parseInt(offset));
    if (wing_id)          q = q.where('bank_transactions.wing_id', wing_id);
    if (bank_account_id)  q = q.where('bank_transactions.bank_account_id', bank_account_id);
    if (type)             q = q.where('bank_transactions.type', type);
    if (from)             q = q.where('bank_transactions.transaction_date', '>=', from);
    if (to)               q = q.where('bank_transactions.transaction_date', '<=', to);
    res.json(await q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/transactions', async (req, res) => {
  try {
    const {
      bank_account_id, wing_id, type, amount, currency_code,
      exchange_rate, description, reference, category, transaction_date,
    } = req.body;
    if (!bank_account_id || !wing_id || !type || !amount || !description || !transaction_date) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const rate = parseFloat(exchange_rate) || 1;
    const amt  = parseFloat(amount);
    const pkr  = (currency_code === 'PKR') ? amt : amt * rate;

    const account = await db('bank_accounts').where({ id: bank_account_id }).first();
    if (!account) return res.status(404).json({ error: 'Bank account not found' });

    const newBalance = type === 'credit'
      ? parseFloat(account.current_balance) + amt
      : parseFloat(account.current_balance) - amt;

    const [txn] = await db.transaction(async (trx) => {
      const inserted = await trx('bank_transactions').insert({
        bank_account_id, wing_id, type, amount: amt,
        currency_code: currency_code || 'PKR',
        exchange_rate: rate, pkr_amount: pkr,
        description, reference, category, transaction_date,
        balance_after: newBalance,
        created_by: req.user.id,
      }).returning('*');
      await trx('bank_accounts').where({ id: bank_account_id })
        .update({ current_balance: newBalance, updated_at: new Date() });
      return inserted;
    });

    res.status(201).json(txn);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const txn = await db('bank_transactions').where({ id: req.params.id }).first();
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const reversal = txn.type === 'credit' ? -txn.amount : txn.amount;
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

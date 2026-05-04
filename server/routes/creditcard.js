const router   = require('express').Router();
const db       = require('../db');
const { authenticate } = require('../middleware/auth');
const multer   = require('multer');
const supabase = require('../supabaseClient');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

// ─── helpers ─────────────────────────────────────────────────────────────────
async function uploadInvoice(file) {
  if (!file || !supabase) return { url: null, filename: null };
  const ext  = file.originalname.split('.').pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('cc-invoices')
    .upload(name, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw new Error(`Invoice upload failed: ${error.message}`);
  const { data } = supabase.storage.from('cc-invoices').getPublicUrl(name);
  return { url: data.publicUrl, filename: file.originalname };
}

// ─── GET /balance ─────────────────────────────────────────────────────────────
router.get('/balance', async (req, res) => {
  try {
    const cc = await db('credit_cards').first();
    if (!cc) return res.status(404).json({ error: 'Credit card not set up. Run supabase_subscriptions_v1.sql.' });
    res.json(cc);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST /recharge — load funds from bank account onto CC ────────────────────
router.post('/recharge', async (req, res) => {
  try {
    const { bank_account_id, amount, recharge_date, notes } = req.body;
    if (!bank_account_id || !amount) {
      return res.status(400).json({ error: 'bank_account_id and amount are required' });
    }

    const funds = parseFloat(amount);
    const date  = recharge_date || new Date().toISOString().split('T')[0];

    await db.transaction(async (trx) => {
      const cc      = await trx('credit_cards').first();
      const account = await trx('bank_accounts').where({ id: bank_account_id }).first();
      if (!cc)      throw new Error('Credit card record not found');
      if (!account) throw new Error('Bank account not found');
      if (parseFloat(account.current_balance) < funds) throw new Error('Insufficient bank account balance');

      const newBankBalance = parseFloat(account.current_balance) - funds;
      const newCCBalance   = parseFloat(cc.current_balance) + funds;

      // Debit bank account
      await trx('bank_transactions').insert({
        bank_account_id,
        business_wing_id: account.wing_id || null,
        txn_type:         'Debit',
        amount:           funds,
        currency:         account.currency || account.currency_code || 'PKR',
        description:      `CC Recharge — ${notes || cc.name}`,
        reference_type:   'cc_recharge',
        txn_date:         date,
        running_balance:  newBankBalance,
      });
      await trx('bank_accounts').where({ id: bank_account_id }).update({ current_balance: newBankBalance });

      // Credit CC
      await trx('credit_card_txns').insert({
        credit_card_id:  cc.id,
        txn_date:        date,
        merchant:        'Bank Transfer',
        description:     notes || `Recharge from ${account.bank_name || 'bank'}`,
        amount:          funds,
        currency:        cc.currency,
        category:        'recharge',
        txn_type:        'credit',
        status:          'reconciled',
      });
      await trx('credit_cards').where({ id: cc.id }).update({ current_balance: newCCBalance });
    });

    const cc = await db('credit_cards').first();
    res.json(cc);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ─── GET / ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { wing_id, status, month } = req.query;
    let q = db('credit_card_txns')
      .leftJoin('business_wings', 'business_wings.id', 'credit_card_txns.business_wing_id')
      .select(
        'credit_card_txns.id',
        'credit_card_txns.txn_date',
        'credit_card_txns.merchant',
        'credit_card_txns.description',
        'credit_card_txns.amount',
        'credit_card_txns.currency',
        'credit_card_txns.category',
        'credit_card_txns.business_wing_id',
        'credit_card_txns.notes',
        'credit_card_txns.invoice_url',
        'credit_card_txns.invoice_filename',
        'credit_card_txns.status',
        'credit_card_txns.txn_type',
        'credit_card_txns.reference_type',
        'credit_card_txns.created_at',
        'business_wings.name as wing_name',
      )
      .orderBy('credit_card_txns.txn_date', 'desc');

    if (wing_id) q = q.where('credit_card_txns.business_wing_id', wing_id);
    if (status)  q = q.where('credit_card_txns.status', status);
    if (month)   q = q.whereRaw("TO_CHAR(credit_card_txns.txn_date, 'YYYY-MM') = ?", [month]);

    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── POST / ──────────────────────────────────────────────────────────────────
router.post('/', upload.single('invoice'), async (req, res) => {
  try {
    const { txn_date, merchant, description, amount, currency, category, wing_id, notes, status } = req.body;
    if (!txn_date || !merchant || !amount) {
      return res.status(400).json({ error: 'txn_date, merchant, amount are required' });
    }

    const { url, filename } = await uploadInvoice(req.file);

    const [txn] = await db('credit_card_txns').insert({
      txn_date,
      merchant,
      description:      description    || null,
      amount:           parseFloat(amount),
      currency:         currency        || 'PKR',
      category:         category        || null,
      business_wing_id: wing_id         || null,
      notes:            notes           || null,
      invoice_url:      url,
      invoice_filename: filename,
      status:           status          || 'pending',
    }).returning('*');

    res.status(201).json(txn);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
router.put('/:id', upload.single('invoice'), async (req, res) => {
  try {
    const existing = await db('credit_card_txns').where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { txn_date, merchant, description, amount, currency, category, wing_id, notes, status } = req.body;
    const update = {};
    if (txn_date     !== undefined) update.txn_date          = txn_date;
    if (merchant     !== undefined) update.merchant           = merchant;
    if (description  !== undefined) update.description        = description  || null;
    if (amount       !== undefined) update.amount             = parseFloat(amount);
    if (currency     !== undefined) update.currency           = currency;
    if (category     !== undefined) update.category           = category     || null;
    if (wing_id      !== undefined) update.business_wing_id   = wing_id      || null;
    if (notes        !== undefined) update.notes              = notes        || null;
    if (status       !== undefined) update.status             = status;

    if (req.file) {
      const { url, filename } = await uploadInvoice(req.file);
      update.invoice_url      = url;
      update.invoice_filename = filename;
    }

    await db('credit_card_txns').where({ id: req.params.id }).update(update);
    const updated = await db('credit_card_txns').where({ id: req.params.id }).first();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const n = await db('credit_card_txns').where({ id: req.params.id }).delete();
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

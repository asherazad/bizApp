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

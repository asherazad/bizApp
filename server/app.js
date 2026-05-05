const express   = require('express');
const cors      = require('cors');
const supabase  = require('./supabaseClient');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/wings',         require('./routes/wings'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/banks',         require('./routes/banks'));
app.use('/api/clients',       require('./routes/clients'));
app.use('/api/invoices',      require('./routes/invoices'));
app.use('/api/purchase-orders', require('./routes/po'));
app.use('/api/tax',           require('./routes/tax'));
app.use('/api/resources',     require('./routes/resources'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/payroll',       require('./routes/payroll'));
app.use('/api/loans',         require('./routes/loans'));
app.use('/api/bills',         require('./routes/bills'));
app.use('/api/travel',        require('./routes/travel'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/reminders',     require('./routes/reminders'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/creditcard',    require('./routes/creditcard'));
app.use('/api/wave',          require('./routes/wave'));

app.get('/api/health', async (_req, res) => {
  if (!supabase) return res.status(503).json({ status: 'error', db: 'disabled', message: 'Supabase env vars not set' });
  try {
    const { error } = await supabase.from('business_wings').select('id', { count: 'exact', head: true });
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected', ts: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: err.message });
  }
});

// Temporary debug route — remove after resolving env var issues
app.get('/api/debug', (_req, res) => {
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  let dbHost = 'not set';
  try { dbHost = new URL(dbUrl).hostname; } catch {}
  res.json({
    node_env:         process.env.NODE_ENV,
    db_host:          dbHost,
    has_jwt:          !!process.env.JWT_SECRET,
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
});

// Global error handler — catches any thrown errors or next(err) calls
app.use((err, req, res, next) => {
  console.error('unhandled express error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Catch unhandled promise rejections so Node 20 doesn't crash the process
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
});

module.exports = app;

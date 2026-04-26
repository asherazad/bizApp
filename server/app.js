const express = require('express');
const cors    = require('cors');

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
app.use('/api/bills',         require('./routes/bills'));
app.use('/api/travel',        require('./routes/travel'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/reminders',     require('./routes/reminders'));
app.use('/api/dashboard',     require('./routes/dashboard'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

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

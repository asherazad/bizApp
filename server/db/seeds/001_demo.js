const bcrypt = require('bcryptjs');

exports.seed = async (knex) => {
  // Truncate in reverse dependency order
  const tables = [
    'reminders','subscriptions','travel_records','bills','loan_repayments',
    'loans_advances','payroll_items','payroll_runs','leave_requests','attendance',
    'contracts','resource_wings','resources','tax_challans','invoice_payments',
    'invoice_items','invoices','po_items','purchase_orders','clients',
    'bank_transactions','bank_accounts','exchange_rates','user_wings',
    'users','currencies','business_wings',
  ];
  for (const t of tables) await knex(t).del();

  // Currencies
  await knex('currencies').insert([
    { code: 'PKR', name: 'Pakistani Rupee',  symbol: '₨' },
    { code: 'USD', name: 'US Dollar',         symbol: '$' },
    { code: 'EUR', name: 'Euro',              symbol: '€' },
    { code: 'AED', name: 'UAE Dirham',        symbol: 'د.إ' },
    { code: 'GBP', name: 'British Pound',     symbol: '£' },
  ]);

  // Exchange rates (approximate at seed time)
  const today = new Date().toISOString().split('T')[0];
  await knex('exchange_rates').insert([
    { from_currency: 'USD', to_currency: 'PKR', rate: 278.50, rate_date: today },
    { from_currency: 'EUR', to_currency: 'PKR', rate: 301.20, rate_date: today },
    { from_currency: 'AED', to_currency: 'PKR', rate: 75.85,  rate_date: today },
    { from_currency: 'GBP', to_currency: 'PKR', rate: 353.00, rate_date: today },
  ]);

  // Business Wings
  const [techWing, realEstateWing, tradingWing] = await knex('business_wings').insert([
    { name: 'Technology Services', code: 'TECH', description: 'Software development and IT services' },
    { name: 'Real Estate',         code: 'RE',   description: 'Property management and development' },
    { name: 'Trading',             code: 'TRD',  description: 'Import/export and commodities trading' },
  ]).returning('*');

  // Admin user
  const hash = await bcrypt.hash('admin123', 10);
  const [admin] = await knex('users').insert([
    { name: 'Admin User', email: 'admin@nexus.local', password_hash: hash, role: 'admin' },
  ]).returning('*');

  // Assign admin to all wings
  await knex('user_wings').insert([
    { user_id: admin.id, wing_id: techWing.id },
    { user_id: admin.id, wing_id: realEstateWing.id },
    { user_id: admin.id, wing_id: tradingWing.id },
  ]);

  // Bank accounts
  const [techBank, reBank, trdBank] = await knex('bank_accounts').insert([
    {
      wing_id: techWing.id, bank_name: 'Habib Bank Limited',
      account_number: '1234-5678-001', account_title: 'Technology Services Operations',
      currency_code: 'PKR', opening_balance: 2500000, current_balance: 2500000,
    },
    {
      wing_id: realEstateWing.id, bank_name: 'Meezan Bank',
      account_number: '9876-5432-002', account_title: 'Real Estate Development',
      currency_code: 'PKR', opening_balance: 5000000, current_balance: 5000000,
    },
    {
      wing_id: tradingWing.id, bank_name: 'United Bank Limited',
      account_number: '5555-1111-003', account_title: 'Trading Operations USD',
      currency_code: 'USD', opening_balance: 50000, current_balance: 50000,
    },
  ]).returning('*');

  // Clients
  await knex('clients').insert([
    {
      wing_id: techWing.id, name: 'Acme Corp', email: 'billing@acme.com',
      phone: '+92-21-1234567', type: 'client',
    },
    {
      wing_id: techWing.id, name: 'AWS Pakistan', email: 'accounts@aws.com',
      type: 'vendor',
    },
    {
      wing_id: tradingWing.id, name: 'Al Futtaim Group', email: 'trade@alfuttaim.ae',
      phone: '+971-4-9876543', type: 'both',
    },
  ]);
};

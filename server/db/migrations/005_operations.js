exports.up = async (knex) => {
  // Payroll runs
  await knex.schema.createTable('payroll_runs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.integer('period_month').notNullable();
    t.integer('period_year').notNullable();
    t.enum('status', ['draft', 'finalized', 'paid']).defaultTo('draft');
    t.decimal('total_gross', 18, 2).defaultTo(0);
    t.decimal('total_deductions', 18, 2).defaultTo(0);
    t.decimal('total_net', 18, 2).defaultTo(0);
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.timestamps(true, true);
    t.unique(['wing_id', 'period_month', 'period_year']);
  });

  await knex.schema.createTable('payroll_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('payroll_run_id').notNullable().references('id').inTable('payroll_runs').onDelete('CASCADE');
    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('RESTRICT');
    t.decimal('base_salary', 18, 2).notNullable();
    t.decimal('overtime_amount', 18, 2).defaultTo(0);
    t.decimal('bonus', 18, 2).defaultTo(0);
    t.decimal('loan_deduction', 18, 2).defaultTo(0);
    t.decimal('tax_deduction', 18, 2).defaultTo(0);
    t.decimal('other_deductions', 18, 2).defaultTo(0);
    t.decimal('net_amount', 18, 2).notNullable();
    t.enum('payment_status', ['pending', 'paid']).defaultTo('pending');
    t.date('payment_date');
    t.string('reference');
  });

  // Loans & Advances
  await knex.schema.createTable('loans_advances', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.enum('loan_type', ['loan', 'advance']).defaultTo('loan');
    t.decimal('amount', 18, 2).notNullable();
    t.decimal('remaining_balance', 18, 2).notNullable();
    t.date('issued_date').notNullable();
    t.integer('installment_months');
    t.text('purpose');
    t.enum('status', ['active', 'settled', 'written_off']).defaultTo('active');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('loan_repayments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('loan_id').notNullable().references('id').inTable('loans_advances').onDelete('CASCADE');
    t.uuid('payroll_item_id').references('id').inTable('payroll_items').onDelete('SET NULL');
    t.decimal('amount', 18, 2).notNullable();
    t.date('repayment_date').notNullable();
    t.text('notes');
  });

  // Bill Payments
  await knex.schema.createTable('bills', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('vendor_id').references('id').inTable('clients').onDelete('SET NULL');
    t.string('bill_number');
    t.string('category').notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().defaultTo('PKR').references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    t.date('bill_date').notNullable();
    t.date('due_date');
    t.date('paid_date');
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.enum('status', ['pending', 'paid', 'overdue', 'disputed']).defaultTo('pending');
    t.text('notes');
    t.timestamps(true, true);
  });

  // Travel Records
  await knex.schema.createTable('travel_records', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('resource_id').references('id').inTable('resources').onDelete('SET NULL');
    t.string('destination').notNullable();
    t.string('purpose');
    t.date('departure_date').notNullable();
    t.date('return_date');
    t.decimal('total_cost', 18, 2).defaultTo(0);
    t.string('currency_code', 10).notNullable().defaultTo('PKR').references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('pkr_cost', 18, 2).defaultTo(0);
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.text('notes');
    t.timestamps(true, true);
  });

  // Monthly Subscriptions
  await knex.schema.createTable('subscriptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('service_name').notNullable();
    t.text('description');
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().defaultTo('PKR').references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    t.enum('billing_cycle', ['monthly', 'quarterly', 'semi_annual', 'annual']).defaultTo('monthly');
    t.date('next_billing_date').notNullable();
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.boolean('is_active').defaultTo(true);
    t.text('notes');
    t.timestamps(true, true);
  });

  // Business Reminders
  await knex.schema.createTable('reminders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').references('id').inTable('business_wings').onDelete('CASCADE');
    t.string('title').notNullable();
    t.text('description');
    t.timestamp('due_at').notNullable();
    t.enum('category', ['tax', 'compliance', 'payment', 'contract', 'general']).defaultTo('general');
    t.enum('priority', ['low', 'medium', 'high']).defaultTo('medium');
    t.boolean('is_recurring').defaultTo(false);
    t.string('recurrence_pattern');
    t.boolean('is_completed').defaultTo(false);
    t.timestamp('completed_at');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('reminders');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('travel_records');
  await knex.schema.dropTableIfExists('bills');
  await knex.schema.dropTableIfExists('loan_repayments');
  await knex.schema.dropTableIfExists('loans_advances');
  await knex.schema.dropTableIfExists('payroll_items');
  await knex.schema.dropTableIfExists('payroll_runs');
};

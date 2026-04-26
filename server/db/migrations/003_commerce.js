exports.up = async (knex) => {
  // Clients & Vendors
  await knex.schema.createTable('clients', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('name').notNullable();
    t.string('email');
    t.string('phone');
    t.text('address');
    t.string('ntn');
    t.string('strn');
    t.enum('type', ['client', 'vendor', 'both']).notNullable().defaultTo('client');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Purchase Orders
  await knex.schema.createTable('purchase_orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('vendor_id').references('id').inTable('clients').onDelete('SET NULL');
    t.string('po_number').notNullable().unique();
    t.enum('status', ['draft', 'sent', 'acknowledged', 'partially_invoiced', 'fully_invoiced', 'cancelled']).defaultTo('draft');
    t.string('currency_code', 10).notNullable().defaultTo('PKR').references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('total_amount', 18, 2).notNullable().defaultTo(0);
    t.decimal('pkr_total', 18, 2).notNullable().defaultTo(0);
    t.decimal('invoiced_amount', 18, 2).defaultTo(0);
    t.date('order_date').notNullable();
    t.date('expected_date');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('po_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('po_id').notNullable().references('id').inTable('purchase_orders').onDelete('CASCADE');
    t.text('description').notNullable();
    t.decimal('quantity', 12, 3).notNullable().defaultTo(1);
    t.decimal('unit_price', 18, 2).notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.integer('sort_order').defaultTo(0);
  });

  // Invoices
  await knex.schema.createTable('invoices', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('client_id').references('id').inTable('clients').onDelete('SET NULL');
    t.uuid('po_id').references('id').inTable('purchase_orders').onDelete('SET NULL');
    t.string('invoice_number').notNullable().unique();
    t.enum('status', ['draft', 'sent', 'partially_paid', 'fully_paid', 'overdue', 'cancelled']).defaultTo('draft');
    t.string('currency_code', 10).notNullable().defaultTo('PKR').references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('subtotal', 18, 2).notNullable().defaultTo(0);
    t.decimal('tax_rate', 5, 2).defaultTo(0);
    t.decimal('tax_amount', 18, 2).defaultTo(0);
    t.decimal('total', 18, 2).notNullable().defaultTo(0);
    t.decimal('pkr_total', 18, 2).notNullable().defaultTo(0);
    t.decimal('paid_amount', 18, 2).defaultTo(0);
    t.date('issue_date').notNullable();
    t.date('due_date');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('invoice_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    t.text('description').notNullable();
    t.decimal('quantity', 12, 3).notNullable().defaultTo(1);
    t.decimal('unit_price', 18, 2).notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.integer('sort_order').defaultTo(0);
  });

  await knex.schema.createTable('invoice_payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    t.date('paid_date').notNullable();
    t.string('reference');
    t.text('notes');
    t.timestamps(true, true);
  });

  // Tax Challans
  await knex.schema.createTable('tax_challans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('challan_number');
    t.enum('tax_type', ['sales_tax', 'income_tax', 'salary_tax', 'advance_tax', 'withholding_tax', 'other']).notNullable();
    t.date('period_start').notNullable();
    t.date('period_end').notNullable();
    t.decimal('taxable_amount', 18, 2).defaultTo(0);
    t.decimal('tax_amount', 18, 2).notNullable();
    t.decimal('penalty', 18, 2).defaultTo(0);
    t.decimal('total_paid', 18, 2).defaultTo(0);
    t.enum('status', ['pending', 'paid', 'overdue', 'disputed']).defaultTo('pending');
    t.date('due_date');
    t.date('paid_date');
    t.uuid('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.text('notes');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('tax_challans');
  await knex.schema.dropTableIfExists('invoice_payments');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('po_items');
  await knex.schema.dropTableIfExists('purchase_orders');
  await knex.schema.dropTableIfExists('clients');
};

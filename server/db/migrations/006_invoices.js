// Invoice — parsed invoice with line items; optionally linked to a PO
// invoice_payments — tracks partial payments; auto-updates paid_amount + status
exports.up = async (knex) => {
  await knex.schema.createTable('invoices', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('client_id')
      .references('id').inTable('clients').onDelete('SET NULL');
    t.uuid('po_id')
      .references('id').inTable('purchase_orders').onDelete('SET NULL');
    t.string('invoice_number', 100).notNullable().unique();
    // draft | sent | partially_paid | fully_paid | overdue | cancelled
    t.string('status', 30).notNullable().defaultTo('draft');
    t.string('currency_code', 10).notNullable().defaultTo('PKR')
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('subtotal', 18, 2).notNullable().defaultTo(0);
    t.decimal('tax_rate', 5, 2).notNullable().defaultTo(0);
    t.decimal('tax_amount', 18, 2).notNullable().defaultTo(0);
    t.decimal('total', 18, 2).notNullable().defaultTo(0);
    t.decimal('pkr_total', 18, 2).notNullable().defaultTo(0);
    t.decimal('paid_amount', 18, 2).notNullable().defaultTo(0);
    t.date('issue_date').notNullable();
    t.date('due_date');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('invoice_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('invoice_id').notNullable()
      .references('id').inTable('invoices').onDelete('CASCADE');
    t.text('description').notNullable();
    t.decimal('quantity', 12, 3).notNullable().defaultTo(1);
    t.decimal('unit_price', 18, 2).notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('invoice_payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('invoice_id').notNullable()
      .references('id').inTable('invoices').onDelete('CASCADE');
    t.uuid('bank_account_id')
      .references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable()
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    t.date('paid_date').notNullable();
    t.string('reference', 255);
    t.text('notes');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('invoice_payments');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
};

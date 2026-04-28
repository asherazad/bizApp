// PurchaseOrder — client PO with line items; remaining balance = total - invoiced
exports.up = async (knex) => {
  await knex.schema.createTable('purchase_orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('vendor_id')
      .references('id').inTable('clients').onDelete('SET NULL');
    t.string('po_number', 100).notNullable().unique();
    // draft | sent | acknowledged | partially_invoiced | fully_invoiced | cancelled
    t.string('status', 30).notNullable().defaultTo('draft');
    t.string('currency_code', 10).notNullable().defaultTo('PKR')
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('total_amount', 18, 2).notNullable().defaultTo(0);
    t.decimal('pkr_total', 18, 2).notNullable().defaultTo(0);
    t.decimal('invoiced_amount', 18, 2).notNullable().defaultTo(0); // updated as invoices link
    t.date('order_date').notNullable();
    t.date('expected_date');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('po_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('po_id').notNullable()
      .references('id').inTable('purchase_orders').onDelete('CASCADE');
    t.text('description').notNullable();
    t.decimal('quantity', 12, 3).notNullable().defaultTo(1);
    t.decimal('unit_price', 18, 2).notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('po_items');
  await knex.schema.dropTableIfExists('purchase_orders');
};

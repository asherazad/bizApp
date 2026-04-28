// BillPayment  — utility/vendor bill with due date, payment date, bank account
// TravelRecord — resource-wise travel; importable from Excel
// Subscription  — recurring service with renewal date and active status
// Reminder      — one-time or recurring alert with lead_time_hours before due_at
exports.up = async (knex) => {
  await knex.schema.createTable('bill_payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('vendor_id')
      .references('id').inTable('clients').onDelete('SET NULL');
    t.string('bill_number', 100);
    t.string('category', 100).notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().defaultTo('PKR')
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    t.date('bill_date').notNullable();
    t.date('due_date');
    t.date('paid_date');
    t.uuid('bank_account_id')
      .references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.string('status', 20).notNullable().defaultTo('pending'); // pending | paid | overdue | disputed
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('travel_records', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.uuid('resource_id')
      .references('id').inTable('resources').onDelete('SET NULL');
    t.string('destination', 255).notNullable();
    t.string('purpose', 255);
    t.date('departure_date').notNullable();
    t.date('return_date');
    t.decimal('total_cost', 18, 2).notNullable().defaultTo(0);
    t.string('currency_code', 10).notNullable().defaultTo('PKR')
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('pkr_cost', 18, 2).notNullable().defaultTo(0);
    t.uuid('bank_account_id')
      .references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('subscriptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('service_name', 255).notNullable();
    t.text('description');
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().defaultTo('PKR')
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    // monthly | quarterly | semi_annual | annual
    t.string('billing_cycle', 20).notNullable().defaultTo('monthly');
    t.date('next_billing_date').notNullable();
    t.uuid('bank_account_id')
      .references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('reminders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id')
      .references('id').inTable('business_wings').onDelete('CASCADE'); // null = global
    t.string('title', 255).notNullable();
    t.text('description');
    t.timestamp('due_at').notNullable();
    // tax | compliance | payment | contract | general
    t.string('category', 30).notNullable().defaultTo('general');
    t.string('priority', 10).notNullable().defaultTo('medium'); // low | medium | high
    t.integer('lead_time_hours').notNullable().defaultTo(24);   // alert X hours before due_at
    t.boolean('is_recurring').notNullable().defaultTo(false);
    t.string('recurrence_pattern', 100);                        // monthly | quarterly | …
    t.boolean('is_completed').notNullable().defaultTo(false);
    t.timestamp('completed_at');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('reminders');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('travel_records');
  await knex.schema.dropTableIfExists('bill_payments');
};

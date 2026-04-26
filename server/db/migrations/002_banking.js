exports.up = async (knex) => {
  await knex.schema.createTable('bank_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('bank_name').notNullable();
    t.string('account_number').notNullable();
    t.string('account_title').notNullable();
    t.string('branch');
    t.string('iban', 34);
    t.string('currency_code', 10).notNullable().defaultTo('PKR').references('code').inTable('currencies');
    t.decimal('opening_balance', 18, 2).defaultTo(0);
    t.decimal('current_balance', 18, 2).defaultTo(0);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('bank_transactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('bank_account_id').notNullable().references('id').inTable('bank_accounts').onDelete('RESTRICT');
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.enum('type', ['credit', 'debit']).notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    t.string('description').notNullable();
    t.string('reference');
    t.string('category');
    t.date('transaction_date').notNullable();
    t.decimal('balance_after', 18, 2);
    t.uuid('created_by').references('id').inTable('users');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('bank_transactions');
  await knex.schema.dropTableIfExists('bank_accounts');
};

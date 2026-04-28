// BankTransaction — debit/credit against a BankAccount, tagged to BusinessWing
// balance_after is stored at insert time (not computed) for fast history display
exports.up = async (knex) => {
  await knex.schema.createTable('bank_transactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('bank_account_id').notNullable()
      .references('id').inTable('bank_accounts').onDelete('RESTRICT');
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('type', 10).notNullable();                     // credit | debit
    t.decimal('amount', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable()
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('pkr_amount', 18, 2).notNullable();
    t.string('description', 500).notNullable();
    t.string('reference', 255);
    t.string('category', 100);
    t.date('transaction_date').notNullable();
    t.decimal('balance_after', 18, 2);                     // snapshot after this txn
    t.uuid('created_by')
      .references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('bank_transactions');
};

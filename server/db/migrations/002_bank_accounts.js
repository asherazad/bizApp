// BankAccount — owned by a BusinessWing; tracks currency + running balance
exports.up = async (knex) => {
  await knex.schema.createTable('bank_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('bank_name', 255).notNullable();
    t.string('account_title', 255).notNullable();
    t.string('account_number', 100).notNullable();
    t.string('iban', 34);
    t.string('swift_code', 20);
    t.string('branch', 255);
    t.string('currency_code', 10).notNullable().defaultTo('PKR')
      .references('code').inTable('currencies');
    t.decimal('opening_balance', 18, 2).notNullable().defaultTo(0);
    t.decimal('current_balance', 18, 2).notNullable().defaultTo(0);
    t.boolean('is_shared').notNullable().defaultTo(false);  // shared across wings
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('bank_accounts');
};

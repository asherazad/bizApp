exports.up = async (knex) => {
  // Business Wings — top-level entities
  await knex.schema.createTable('business_wings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('code', 20).notNullable().unique();
    t.text('description');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Users
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.enum('role', ['admin', 'manager', 'viewer']).defaultTo('viewer');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // User ↔ Wing access
  await knex.schema.createTable('user_wings', (t) => {
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('CASCADE');
    t.primary(['user_id', 'wing_id']);
  });

  // Supported currencies
  await knex.schema.createTable('currencies', (t) => {
    t.string('code', 10).primary();
    t.string('name').notNullable();
    t.string('symbol', 10).notNullable();
  });

  // Exchange rates (snapshot at time of recording)
  await knex.schema.createTable('exchange_rates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('from_currency', 10).notNullable().references('code').inTable('currencies');
    t.string('to_currency', 10).notNullable().references('code').inTable('currencies');
    t.decimal('rate', 18, 6).notNullable();
    t.date('rate_date').notNullable();
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('exchange_rates');
  await knex.schema.dropTableIfExists('currencies');
  await knex.schema.dropTableIfExists('user_wings');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('business_wings');
};

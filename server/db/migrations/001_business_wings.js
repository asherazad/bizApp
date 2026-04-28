// Foundation: currencies lookup + BusinessWing (every record links here)
exports.up = async (knex) => {
  await knex.schema.createTable('currencies', (t) => {
    t.string('code', 10).primary();
    t.string('name', 100).notNullable();
    t.string('symbol', 10).notNullable();
  });

  await knex.schema.createTable('business_wings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('code', 20).notNullable().unique();          // short tag: TECH, RE, TRD
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('business_wings');
  await knex.schema.dropTableIfExists('currencies');
};

// Client — external party (customer, vendor, or both); linked to a wing
exports.up = async (knex) => {
  await knex.schema.createTable('clients', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('name', 255).notNullable();
    t.string('type', 20).notNullable().defaultTo('client'); // client | vendor | both
    t.string('email', 255);
    t.string('phone', 50);
    t.text('address');
    t.string('ntn', 50);   // National Tax Number
    t.string('strn', 50);  // Sales Tax Registration Number
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('clients');
};

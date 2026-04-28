// User + WingAccessGrant (who can see which wings)
exports.up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('role', 20).notNullable().defaultTo('viewer'); // admin | manager | viewer
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_login_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('wing_access_grants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('CASCADE');
    t.uuid('granted_by')
      .references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['user_id', 'wing_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('wing_access_grants');
  await knex.schema.dropTableIfExists('users');
};

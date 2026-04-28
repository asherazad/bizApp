// Resource — employee or contractor
// resource_wing_assignments — many-to-many: resource belongs to one or more wings
// salary_contracts — contract + salary structure per resource per wing
exports.up = async (knex) => {
  await knex.schema.createTable('resources', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('type', 20).notNullable().defaultTo('employee'); // employee | contractor
    t.string('cnic', 15).unique();
    t.string('email', 255);
    t.string('phone', 50);
    t.text('address');
    t.date('date_of_birth');
    t.string('emergency_contact', 255);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('resource_wing_assignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable()
      .references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('designation', 255);
    t.string('department', 255);
    t.date('start_date').notNullable();
    t.date('end_date');
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.unique(['resource_id', 'wing_id']);
  });

  await knex.schema.createTable('salary_contracts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable()
      .references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    // permanent | contract | part_time | internship
    t.string('contract_type', 20).notNullable().defaultTo('permanent');
    t.date('start_date').notNullable();
    t.date('end_date');
    t.decimal('salary', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().defaultTo('PKR')
      .references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).notNullable().defaultTo(1);
    t.decimal('pkr_salary', 18, 2).notNullable();
    t.string('status', 20).notNullable().defaultTo('active'); // active | expired | terminated
    t.string('document_path', 500);
    t.text('notes');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('salary_contracts');
  await knex.schema.dropTableIfExists('resource_wing_assignments');
  await knex.schema.dropTableIfExists('resources');
};

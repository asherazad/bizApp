exports.up = async (knex) => {
  // Resources (employees / contractors)
  await knex.schema.createTable('resources', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.enum('type', ['employee', 'contractor']).notNullable().defaultTo('employee');
    t.string('cnic', 15);
    t.string('email');
    t.string('phone');
    t.text('address');
    t.date('date_of_birth');
    t.string('emergency_contact');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Resource ↔ Wing assignments
  await knex.schema.createTable('resource_wings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('designation');
    t.string('department');
    t.date('start_date').notNullable();
    t.date('end_date');
    t.boolean('is_primary').defaultTo(false);
  });

  // Contracts
  await knex.schema.createTable('contracts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.enum('contract_type', ['permanent', 'contract', 'part_time', 'internship']).defaultTo('permanent');
    t.date('start_date').notNullable();
    t.date('end_date');
    t.decimal('salary', 18, 2).notNullable();
    t.string('currency_code', 10).notNullable().defaultTo('PKR').references('code').inTable('currencies');
    t.decimal('exchange_rate', 18, 6).defaultTo(1);
    t.decimal('pkr_salary', 18, 2).notNullable();
    t.enum('status', ['active', 'expired', 'terminated']).defaultTo('active');
    t.string('document_path');
    t.text('notes');
    t.timestamps(true, true);
  });

  // Attendance
  await knex.schema.createTable('attendance', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.date('date').notNullable();
    t.time('check_in');
    t.time('check_out');
    t.enum('status', ['present', 'absent', 'half_day', 'leave', 'holiday', 'work_from_home']).notNullable().defaultTo('present');
    t.decimal('overtime_hours', 5, 2).defaultTo(0);
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['resource_id', 'date']);
  });

  // Leave requests
  await knex.schema.createTable('leave_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable().references('id').inTable('business_wings').onDelete('RESTRICT');
    t.enum('leave_type', ['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid', 'other']).notNullable();
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.integer('days').notNullable().defaultTo(1);
    t.enum('status', ['pending', 'approved', 'rejected', 'cancelled']).defaultTo('pending');
    t.text('reason');
    t.text('notes');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('leave_requests');
  await knex.schema.dropTableIfExists('attendance');
  await knex.schema.dropTableIfExists('contracts');
  await knex.schema.dropTableIfExists('resource_wings');
  await knex.schema.dropTableIfExists('resources');
};

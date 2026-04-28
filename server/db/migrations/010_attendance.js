// AttendanceRecord — daily record per resource; unique on (resource_id, date)
// LeaveBalance — annual entitlement vs consumed per resource per wing per year
exports.up = async (knex) => {
  await knex.schema.createTable('attendance_records', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable()
      .references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.date('date').notNullable();
    t.time('check_in');
    t.time('check_out');
    // present | absent | half_day | leave | holiday | work_from_home
    t.string('status', 20).notNullable().defaultTo('present');
    // annual | sick | casual | maternity | paternity | unpaid (populated when status = leave)
    t.string('leave_type', 20);
    t.decimal('overtime_hours', 5, 2).notNullable().defaultTo(0);
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['resource_id', 'date']);
  });

  await knex.schema.createTable('leave_balances', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable()
      .references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('leave_type', 20).notNullable(); // annual | sick | casual
    t.integer('year').notNullable();
    t.decimal('entitled_days', 5, 1).notNullable();
    t.decimal('consumed_days', 5, 1).notNullable().defaultTo(0);
    // remaining = entitled - consumed; computed at query time, not stored
    t.unique(['resource_id', 'wing_id', 'leave_type', 'year']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('leave_balances');
  await knex.schema.dropTableIfExists('attendance_records');
};

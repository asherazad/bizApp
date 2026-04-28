// PayrollRun — monthly batch per wing; unique on (wing, month, year)
// payroll_items — per-resource breakdown within a run
// loan_records — loan or advance with remaining balance
// loan_repayments — repayment linked to payroll_items; decrements remaining_balance
exports.up = async (knex) => {
  await knex.schema.createTable('payroll_runs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.integer('period_month').notNullable(); // 1–12
    t.integer('period_year').notNullable();
    t.string('status', 20).notNullable().defaultTo('draft'); // draft | finalized | paid
    t.decimal('total_gross', 18, 2).notNullable().defaultTo(0);
    t.decimal('total_deductions', 18, 2).notNullable().defaultTo(0);
    t.decimal('total_net', 18, 2).notNullable().defaultTo(0);
    t.uuid('bank_account_id')
      .references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.date('payment_date');
    t.timestamps(true, true);
    t.unique(['wing_id', 'period_month', 'period_year']);
  });

  await knex.schema.createTable('payroll_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('payroll_run_id').notNullable()
      .references('id').inTable('payroll_runs').onDelete('CASCADE');
    t.uuid('resource_id').notNullable()
      .references('id').inTable('resources').onDelete('RESTRICT');
    t.decimal('base_salary', 18, 2).notNullable();
    t.decimal('overtime_hours', 5, 2).notNullable().defaultTo(0);
    t.decimal('overtime_rate', 18, 2).notNullable().defaultTo(0);
    t.decimal('overtime_amount', 18, 2).notNullable().defaultTo(0);
    t.decimal('bonus', 18, 2).notNullable().defaultTo(0);
    t.decimal('loan_deduction', 18, 2).notNullable().defaultTo(0);
    t.decimal('tax_deduction', 18, 2).notNullable().defaultTo(0);
    t.decimal('other_deductions', 18, 2).notNullable().defaultTo(0);
    t.decimal('net_amount', 18, 2).notNullable();
    t.string('payment_status', 20).notNullable().defaultTo('pending'); // pending | paid
    t.date('payment_date');
    t.string('reference', 255);
  });

  await knex.schema.createTable('loan_records', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('resource_id').notNullable()
      .references('id').inTable('resources').onDelete('CASCADE');
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('loan_type', 20).notNullable().defaultTo('loan'); // loan | advance
    t.decimal('amount', 18, 2).notNullable();
    t.decimal('remaining_balance', 18, 2).notNullable();
    t.date('issued_date').notNullable();
    t.integer('installment_months');
    t.decimal('monthly_installment', 18, 2);
    t.text('purpose');
    t.string('status', 20).notNullable().defaultTo('active'); // active | settled | written_off
    t.timestamps(true, true);
  });

  await knex.schema.createTable('loan_repayments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('loan_id').notNullable()
      .references('id').inTable('loan_records').onDelete('CASCADE');
    t.uuid('payroll_item_id')
      .references('id').inTable('payroll_items').onDelete('SET NULL');
    t.decimal('amount', 18, 2).notNullable();
    t.date('repayment_date').notNullable();
    t.text('notes');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('loan_repayments');
  await knex.schema.dropTableIfExists('loan_records');
  await knex.schema.dropTableIfExists('payroll_items');
  await knex.schema.dropTableIfExists('payroll_runs');
};

// TaxChallan — sales tax, salary tax, or custom challan with due date + payment record
exports.up = async (knex) => {
  await knex.schema.createTable('tax_challans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');
    t.string('challan_number', 100);
    // sales_tax | income_tax | salary_tax | advance_tax | withholding_tax | other
    t.string('tax_type', 30).notNullable();
    t.date('period_start').notNullable();
    t.date('period_end').notNullable();
    t.decimal('taxable_amount', 18, 2).notNullable().defaultTo(0);
    t.decimal('tax_amount', 18, 2).notNullable();
    t.decimal('penalty', 18, 2).notNullable().defaultTo(0);
    // pending | paid | overdue | disputed
    t.string('status', 20).notNullable().defaultTo('pending');
    t.date('due_date');
    t.date('paid_date');
    t.decimal('total_paid', 18, 2).notNullable().defaultTo(0);
    t.uuid('bank_account_id')
      .references('id').inTable('bank_accounts').onDelete('SET NULL');
    t.text('notes');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('tax_challans');
};

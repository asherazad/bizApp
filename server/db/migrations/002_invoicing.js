exports.up = async (knex) => {

  // ── clients ────────────────────────────────────────────
  await knex.schema.createTable('clients', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.string('name', 200).notNullable()
    t.string('email', 255)
    t.string('phone', 50)
    t.text('address')
    t.string('city', 100)
    t.string('country', 100)
    t.string('tax_number', 100)
    t.string('currency', 3).notNullable().defaultTo('USD')
    t.text('notes')
    t.boolean('is_active').notNullable().defaultTo(true)
    t.timestamps(true, true)
  })
  await knex.raw(`CREATE INDEX idx_clients_tenant ON clients(tenant_id)`)
  await knex.raw(`CREATE INDEX idx_clients_name   ON clients(tenant_id, name)`)

  // ── invoices (unified: invoices + quotations) ──────────
  await knex.raw(`CREATE TYPE doc_type   AS ENUM ('invoice','quotation')`)
  await knex.raw(`CREATE TYPE doc_status AS ENUM (
    'draft','sent','viewed','paid','partial','overdue','cancelled',
    'accepted','rejected','converted'
  )`)

  await knex.schema.createTable('invoices', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.uuid('dept_id').notNullable().references('id').inTable('departments')
    t.uuid('client_id').notNullable().references('id').inTable('clients')
    t.specificType('type',   'doc_type').notNullable().defaultTo('invoice')
    t.specificType('status', 'doc_status').notNullable().defaultTo('draft')
    t.string('number', 50).notNullable()
    t.string('reference', 100)
    t.uuid('converted_from').nullable().references('id').inTable('invoices')
    t.date('issue_date').notNullable().defaultTo(knex.fn.now())
    t.date('due_date')
    t.timestamp('sent_at')
    t.timestamp('viewed_at')
    t.timestamp('paid_at')
    t.string('client_name', 200).notNullable()
    t.string('client_email', 255)
    t.text('client_address')
    t.string('currency', 3).notNullable().defaultTo('USD')
    t.decimal('subtotal',      14, 2).notNullable().defaultTo(0)
    t.string('discount_type',  10).defaultTo('percent')
    t.decimal('discount_value',10, 2).notNullable().defaultTo(0)
    t.decimal('discount_amount',14,2).notNullable().defaultTo(0)
    t.decimal('tax_amount',    14, 2).notNullable().defaultTo(0)
    t.decimal('total',         14, 2).notNullable().defaultTo(0)
    t.decimal('amount_paid',   14, 2).notNullable().defaultTo(0)
    t.text('notes')
    t.text('terms')
    t.string('pdf_source', 500)   // original uploaded filename
    t.uuid('created_by').nullable().references('id').inTable('users')
    t.timestamps(true, true)
    t.unique(['tenant_id', 'number'])
  })
  await knex.raw(`CREATE INDEX idx_invoices_tenant ON invoices(tenant_id)`)
  await knex.raw(`CREATE INDEX idx_invoices_client ON invoices(tenant_id, client_id)`)
  await knex.raw(`CREATE INDEX idx_invoices_status ON invoices(tenant_id, status)`)
  await knex.raw(`CREATE INDEX idx_invoices_dept   ON invoices(tenant_id, dept_id)`)
  await knex.raw(`CREATE INDEX idx_invoices_due    ON invoices(tenant_id, due_date)
    WHERE status NOT IN ('paid','cancelled','converted')`)

  // ── invoice_items ──────────────────────────────────────
  await knex.schema.createTable('invoice_items', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE')
    t.uuid('dept_id').nullable().references('id').inTable('departments')  // per-item dept
    t.smallint('sort_order').notNullable().defaultTo(0)
    t.text('description').notNullable()
    t.decimal('quantity',   10, 3).notNullable().defaultTo(1)
    t.decimal('unit_price', 14, 2).notNullable().defaultTo(0)
    t.decimal('discount_pct', 5, 2).notNullable().defaultTo(0)
    t.decimal('tax_pct',      5, 2).notNullable().defaultTo(0)
    t.decimal('line_total',  14, 2).notNullable().defaultTo(0)
    t.decimal('discount_amt',14, 2).notNullable().defaultTo(0)
    t.decimal('taxable_amt', 14, 2).notNullable().defaultTo(0)
    t.decimal('tax_amt',     14, 2).notNullable().defaultTo(0)
    t.decimal('net_total',   14, 2).notNullable().defaultTo(0)
  })
  await knex.raw(`CREATE INDEX idx_items_invoice ON invoice_items(invoice_id)`)

  // ── payments ───────────────────────────────────────────
  await knex.raw(`CREATE TYPE payment_method AS ENUM ('cash','bank_transfer','cheque','card','other')`)

  await knex.schema.createTable('payments', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.uuid('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE')
    t.decimal('amount', 14, 2).notNullable()
    t.specificType('method', 'payment_method').notNullable().defaultTo('bank_transfer')
    t.string('reference', 100)
    t.text('note')
    t.date('payment_date').notNullable().defaultTo(knex.fn.now())
    t.uuid('recorded_by').nullable().references('id').inTable('users')
    t.timestamps(true, true)
  })
  await knex.raw(`CREATE INDEX idx_payments_invoice ON payments(invoice_id)`)
  await knex.raw(`CREATE INDEX idx_payments_tenant  ON payments(tenant_id)`)

  // ── invoice sequences (for auto numbering) ─────────────
  await knex.schema.createTable('invoice_sequences', t => {
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.specificType('type', 'doc_type').notNullable()
    t.smallint('year').notNullable()
    t.integer('last_seq').notNullable().defaultTo(0)
    t.primary(['tenant_id', 'type', 'year'])
  })

  // ── DB function: next invoice number ───────────────────
  await knex.raw(`
    CREATE OR REPLACE FUNCTION next_invoice_number(p_tenant_id UUID, p_type doc_type)
    RETURNS VARCHAR AS $$
    DECLARE
      v_year   SMALLINT := EXTRACT(YEAR FROM NOW());
      v_seq    INTEGER;
      v_prefix VARCHAR(3) := CASE p_type WHEN 'invoice' THEN 'INV' ELSE 'QUO' END;
    BEGIN
      INSERT INTO invoice_sequences(tenant_id, type, year, last_seq)
        VALUES(p_tenant_id, p_type, v_year, 1)
        ON CONFLICT(tenant_id, type, year)
        DO UPDATE SET last_seq = invoice_sequences.last_seq + 1
        RETURNING last_seq INTO v_seq;
      RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    END;
    $$ LANGUAGE plpgsql
  `)

  // ── updated_at triggers ────────────────────────────────
  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql
  `)
  for (const table of ['clients', 'invoices']) {
    await knex.raw(`
      CREATE TRIGGER trg_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `)
  }
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('invoice_sequences')
  await knex.schema.dropTableIfExists('payments')
  await knex.schema.dropTableIfExists('invoice_items')
  await knex.schema.dropTableIfExists('invoices')
  await knex.schema.dropTableIfExists('clients')
  await knex.raw('DROP TYPE IF EXISTS payment_method')
  await knex.raw('DROP TYPE IF EXISTS doc_status')
  await knex.raw('DROP TYPE IF EXISTS doc_type')
}

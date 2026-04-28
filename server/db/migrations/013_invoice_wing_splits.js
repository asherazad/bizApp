// Adds wing_assignment_mode column to invoices and creates invoice_wing_splits.
// Also adds the file storage columns and search indexes added in the previous
// manual migration (idempotent — uses addColumn safely via raw ALTER IF NOT EXISTS).

exports.up = async (knex) => {
  // ── 1. invoices: wing assignment mode ─────────────────────────────────────────
  await knex.raw(`
    ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS wing_assignment_mode TEXT NOT NULL DEFAULT 'single'
        CHECK (wing_assignment_mode IN ('single', 'split', 'line_item'))
  `);

  // ── 2. invoices: file storage metadata ────────────────────────────────────────
  await knex.raw(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_file_path        TEXT`);
  await knex.raw(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_file_name        TEXT`);
  await knex.raw(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_file_size        INTEGER`);
  await knex.raw(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_file_type        TEXT`);
  await knex.raw(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_file_uploaded_at TIMESTAMPTZ`);

  // ── 3. invoice_wing_splits ────────────────────────────────────────────────────
  await knex.schema.createTableIfNotExists('invoice_wing_splits', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    t.uuid('invoice_id').notNullable()
      .references('id').inTable('invoices').onDelete('CASCADE');

    t.uuid('business_wing_id').notNullable()
      .references('id').inTable('business_wings').onDelete('RESTRICT');

    // split_amount is the wing's portion of total_amount (line items + proportional tax)
    t.decimal('split_amount', 18, 2).notNullable();
    // split_percentage is split_amount / total_amount * 100; sums to 100 across all rows for an invoice
    t.decimal('split_percentage', 8, 4).notNullable();
    // pkr_equivalent = split_amount when currency=PKR, else split_amount * exchange_rate
    t.decimal('pkr_equivalent', 18, 2).notNullable();

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // ── 4. Indexes ────────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_invoice_wing_splits_invoice_id
      ON invoice_wing_splits (invoice_id)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_invoice_wing_splits_wing_id
      ON invoice_wing_splits (business_wing_id)
  `);

  // Composite unique: an invoice cannot have two rows for the same wing
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_wing_splits_invoice_wing
      ON invoice_wing_splits (invoice_id, business_wing_id)
  `);

  // Search indexes on invoices (idempotent)
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_vendor_name ON invoices (vendor_name)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_client_name ON invoices (client_name)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_po_id       ON invoices (po_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices (status)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_wing_mode   ON invoices (wing_assignment_mode)`);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('invoice_wing_splits');

  await knex.raw(`ALTER TABLE invoices DROP COLUMN IF EXISTS wing_assignment_mode`);
  await knex.raw(`ALTER TABLE invoices DROP COLUMN IF EXISTS source_file_path`);
  await knex.raw(`ALTER TABLE invoices DROP COLUMN IF EXISTS source_file_name`);
  await knex.raw(`ALTER TABLE invoices DROP COLUMN IF EXISTS source_file_size`);
  await knex.raw(`ALTER TABLE invoices DROP COLUMN IF EXISTS source_file_type`);
  await knex.raw(`ALTER TABLE invoices DROP COLUMN IF EXISTS source_file_uploaded_at`);
};

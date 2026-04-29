exports.up = async (knex) => {
  await knex.schema.alterTable('purchase_orders', (t) => {
    t.text('po_title');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('purchase_orders', (t) => {
    t.dropColumn('po_title');
  });
};

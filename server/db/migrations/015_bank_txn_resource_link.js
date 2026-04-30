exports.up = async (knex) => {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.uuid('linked_resource_id')
      .references('id').inTable('resources').onDelete('SET NULL').nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('bank_transactions', (t) => {
    t.dropColumn('linked_resource_id');
  });
};

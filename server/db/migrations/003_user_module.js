exports.up = async (knex) => {
  // user_business_access — lets a user manage one or many businesses (tenants)
  await knex.schema.createTable('user_business_access', t => {
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.uuid('granted_by').nullable().references('id').inTable('users')
    t.timestamp('granted_at').defaultTo(knex.fn.now())
    t.primary(['user_id', 'tenant_id'])
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('user_business_access')
}

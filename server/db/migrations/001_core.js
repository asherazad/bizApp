exports.up = async (knex) => {
  // Enable uuid extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

  // ── tenants ────────────────────────────────────────────
  await knex.schema.createTable('tenants', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.string('name', 200).notNullable()
    t.string('slug', 50).notNullable().unique()
    t.string('plan', 20).notNullable().defaultTo('starter')
    t.boolean('is_active').notNullable().defaultTo(true)
    t.timestamps(true, true)
  })

  // ── departments ────────────────────────────────────────
  await knex.schema.createTable('departments', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.string('name', 100).notNullable()
    t.string('code', 20)
    t.timestamps(true, true)
    t.unique(['tenant_id', 'code'])
  })

  // ── roles ──────────────────────────────────────────────
  await knex.schema.createTable('roles', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.string('name', 50).notNullable()
    t.jsonb('permissions').notNullable().defaultTo('{}')
    t.boolean('is_system').notNullable().defaultTo(false)
    t.unique(['tenant_id', 'name'])
  })

  // ── users ──────────────────────────────────────────────
  await knex.schema.createTable('users', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
    t.uuid('department_id').nullable().references('id').inTable('departments').onDelete('SET NULL')
    t.string('email', 255).notNullable()
    t.string('password_hash', 255).notNullable()
    t.string('full_name', 100).notNullable()
    t.boolean('is_active').notNullable().defaultTo(true)
    t.timestamp('last_login')
    t.timestamps(true, true)
    t.unique(['tenant_id', 'email'])
  })

  // ── user_roles ─────────────────────────────────────────
  await knex.schema.createTable('user_roles', t => {
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE')
    t.uuid('assigned_by').nullable().references('id').inTable('users')
    t.timestamp('assigned_at').defaultTo(knex.fn.now())
    t.primary(['user_id', 'role_id'])
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('user_roles')
  await knex.schema.dropTableIfExists('users')
  await knex.schema.dropTableIfExists('roles')
  await knex.schema.dropTableIfExists('departments')
  await knex.schema.dropTableIfExists('tenants')
}

const bcrypt = require('bcryptjs')
const { v4: uuid } = require('uuid')

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const DEPT_ENG  = '00000000-0000-0000-0000-000000000010'
const DEPT_SAL  = '00000000-0000-0000-0000-000000000011'
const DEPT_OPS  = '00000000-0000-0000-0000-000000000012'
const ROLE_ADM  = '00000000-0000-0000-0000-000000000020'
const USER_ADM  = '00000000-0000-0000-0000-000000000030'

exports.seed = async (knex) => {
  // Clean in reverse FK order
  await knex('invoice_sequences').del()
  await knex('payments').del()
  await knex('invoice_items').del()
  await knex('invoices').del()
  await knex('clients').del()
  await knex('user_roles').del()
  await knex('users').del()
  await knex('roles').del()
  await knex('departments').del()
  await knex('tenants').del()

  // Tenant
  await knex('tenants').insert({
    id: TENANT_ID, name: 'Acme Technologies', slug: 'acme', plan: 'pro',
  })

  // Departments
  await knex('departments').insert([
    { id: DEPT_ENG, tenant_id: TENANT_ID, name: 'Engineering', code: 'ENG' },
    { id: DEPT_SAL, tenant_id: TENANT_ID, name: 'Sales',       code: 'SAL' },
    { id: DEPT_OPS, tenant_id: TENANT_ID, name: 'Operations',  code: 'OPS' },
  ])

  // Roles
  await knex('roles').insert([
    { id: ROLE_ADM, tenant_id: TENANT_ID, name: 'admin',
      permissions: JSON.stringify({ '*': ['*'] }), is_system: true },
    { id: uuid(), tenant_id: TENANT_ID, name: 'manager',
      permissions: JSON.stringify({ invoices:['read','write'], clients:['read','write'], reports:['read'] }), is_system: true },
    { id: uuid(), tenant_id: TENANT_ID, name: 'employee',
      permissions: JSON.stringify({ invoices:['read'], clients:['read'] }), is_system: true },
  ])

  // Admin user
  const hash = await bcrypt.hash('password', 12)
  await knex('users').insert({
    id: USER_ADM, tenant_id: TENANT_ID, department_id: DEPT_ENG,
    email: 'admin@acme.com', password_hash: hash, full_name: 'Ali Ahmed',
  })
  await knex('user_roles').insert({ user_id: USER_ADM, role_id: ROLE_ADM })

  // Clients
  await knex('clients').insert([
    { id: uuid(), tenant_id: TENANT_ID, name: 'Trust ITC', email: 'rparis@trust-itc.com',
      phone: '+971 56 523 0519', address: '8th Floor Al Wasl 4 - Parcel A, Expo City, Dubai',
      city: 'Dubai', country: 'AE', currency: 'USD' },
    { id: uuid(), tenant_id: TENANT_ID, name: 'Beta Corp', email: 'accounts@betacorp.com',
      phone: '+92 300 1234567', address: '14 Business Park, Lahore',
      city: 'Lahore', country: 'PK', currency: 'USD' },
    { id: uuid(), tenant_id: TENANT_ID, name: 'Gamma Ltd', email: 'finance@gammaltd.io',
      phone: '+971 50 9876543', address: 'Suite 8, DIFC Tower, Dubai',
      city: 'Dubai', country: 'AE', currency: 'USD' },
    { id: uuid(), tenant_id: TENANT_ID, name: 'Delta Inc', email: 'billing@deltainc.com',
      phone: '+1 415 5550199', address: '340 Pine St, San Francisco',
      city: 'San Francisco', country: 'US', currency: 'USD' },
  ])

  console.log('✓ Seed complete — login: admin@acme.com / password')
}

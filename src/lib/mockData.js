// ─── Tenant ──────────────────────────────────────────────
export const mockTenant = {
  id: 'tenant-001',
  name: 'Acme Technologies',
  slug: 'acme',
  plan: 'pro',
  is_active: true,
}

// ─── Departments ─────────────────────────────────────────
export const mockDepartments = [
  { id: 'dept-001', tenant_id: 'tenant-001', name: 'Engineering', code: 'ENG' },
  { id: 'dept-002', tenant_id: 'tenant-001', name: 'Sales',       code: 'SAL' },
  { id: 'dept-003', tenant_id: 'tenant-001', name: 'Operations',  code: 'OPS' },
]

// ─── Roles ───────────────────────────────────────────────
export const mockRoles = [
  { id: 'role-001', name: 'admin',    is_system: true,  permissions: { '*': ['*'] } },
  { id: 'role-002', name: 'manager',  is_system: true,  permissions: { invoices: ['read','write'], expenses: ['read','write'], reports: ['read'], users: ['read'] } },
  { id: 'role-003', name: 'employee', is_system: true,  permissions: { invoices: ['read'], expenses: ['read','write'] } },
  { id: 'role-004', name: 'viewer',   is_system: false, permissions: { invoices: ['read'], reports: ['read'] } },
]

// ─── Users ───────────────────────────────────────────────
export const mockUsers = [
  { id: 'user-001', full_name: 'Ali Ahmed',      email: 'ali@acme.com',     department_id: 'dept-001', role_ids: ['role-001'], is_active: true,  last_login: '2025-04-15T09:22:00Z' },
  { id: 'user-002', full_name: 'Sara Khan',      email: 'sara@acme.com',    department_id: 'dept-002', role_ids: ['role-002'], is_active: true,  last_login: '2025-04-14T14:05:00Z' },
  { id: 'user-003', full_name: 'Omar Farooq',    email: 'omar@acme.com',    department_id: 'dept-001', role_ids: ['role-003'], is_active: true,  last_login: '2025-04-13T11:48:00Z' },
  { id: 'user-004', full_name: 'Nadia Malik',    email: 'nadia@acme.com',   department_id: 'dept-003', role_ids: ['role-003'], is_active: true,  last_login: '2025-04-12T08:30:00Z' },
  { id: 'user-005', full_name: 'Bilal Hussain',  email: 'bilal@acme.com',   department_id: 'dept-002', role_ids: ['role-002'], is_active: false, last_login: '2025-03-28T16:00:00Z' },
]

// ─── Invoices ────────────────────────────────────────────
export const mockInvoices = [
  { id: 'inv-001', number: 'INV-044', client: 'Beta Corp',    dept_id: 'dept-002', amount: 4200,  status: 'paid',    due_date: '2025-04-10', issued_date: '2025-03-25' },
  { id: 'inv-002', number: 'INV-043', client: 'Gamma Ltd',    dept_id: 'dept-001', amount: 2800,  status: 'pending', due_date: '2025-04-20', issued_date: '2025-04-01' },
  { id: 'inv-003', number: 'INV-041', client: 'Delta Inc',    dept_id: 'dept-002', amount: 5600,  status: 'overdue', due_date: '2025-04-04', issued_date: '2025-03-20' },
  { id: 'inv-004', number: 'INV-040', client: 'Omega Systems',dept_id: 'dept-001', amount: 9100,  status: 'paid',    due_date: '2025-04-08', issued_date: '2025-03-22' },
  { id: 'inv-005', number: 'INV-039', client: 'Apex Co',      dept_id: 'dept-003', amount: 1750,  status: 'paid',    due_date: '2025-04-05', issued_date: '2025-03-19' },
  { id: 'inv-006', number: 'INV-045', client: 'Nova Tech',    dept_id: 'dept-001', amount: 6300,  status: 'pending', due_date: '2025-04-28', issued_date: '2025-04-10' },
]

// ─── Expenses ────────────────────────────────────────────
export const mockExpenses = [
  { id: 'exp-001', description: 'AWS cloud infrastructure', category: 'Infrastructure', dept_id: 'dept-001', amount: 2400, date: '2025-04-01', status: 'approved' },
  { id: 'exp-002', description: 'Sales conference travel',  category: 'Travel',         dept_id: 'dept-002', amount: 1200, date: '2025-04-03', status: 'approved' },
  { id: 'exp-003', description: 'Office supplies',          category: 'Admin',          dept_id: 'dept-003', amount: 340,  date: '2025-04-05', status: 'pending'  },
  { id: 'exp-004', description: 'Design software licenses', category: 'Software',       dept_id: 'dept-001', amount: 890,  date: '2025-04-06', status: 'approved' },
  { id: 'exp-005', description: 'Client lunch — Q2 review', category: 'Entertainment', dept_id: 'dept-002', amount: 480,  date: '2025-04-08', status: 'pending'  },
]

// ─── Subscriptions ───────────────────────────────────────
export const mockSubscriptions = [
  { id: 'sub-001', vendor: 'GitHub',         plan: 'Team',        cost: 168,   cycle: 'monthly', renewal_date: '2025-04-18', dept_id: 'dept-001', status: 'active' },
  { id: 'sub-002', vendor: 'Figma',          plan: 'Professional',cost: 360,   cycle: 'annual',  renewal_date: '2025-05-01', dept_id: 'dept-001', status: 'active' },
  { id: 'sub-003', vendor: 'Slack',          plan: 'Pro',         cost: 87,    cycle: 'monthly', renewal_date: '2025-04-22', dept_id: 'dept-003', status: 'active' },
  { id: 'sub-004', vendor: 'HubSpot CRM',    plan: 'Starter',     cost: 540,   cycle: 'monthly', renewal_date: '2025-04-30', dept_id: 'dept-002', status: 'active' },
  { id: 'sub-005', vendor: 'Notion',         plan: 'Business',    cost: 96,    cycle: 'monthly', renewal_date: '2025-05-10', dept_id: 'dept-003', status: 'active' },
]

// ─── Alerts ──────────────────────────────────────────────
export const mockAlerts = [
  { id: 'al-001', type: 'overdue',    message: 'Invoice INV-041 is 12 days overdue',       severity: 'red',   link: '/invoices' },
  { id: 'al-002', type: 'renewal',    message: 'GitHub subscription renews in 2 days',     severity: 'amber', link: '/subscriptions' },
  { id: 'al-003', type: 'approval',   message: 'PO #PO-018 is awaiting your approval',     severity: 'amber', link: '/purchase-orders' },
  { id: 'al-004', type: 'payroll',    message: 'Payroll run due on April 30',              severity: 'blue',  link: '/resources' },
  { id: 'al-005', type: 'expense',    message: '2 expenses pending approval',              severity: 'amber', link: '/expenses' },
]

// ─── P&L summary ─────────────────────────────────────────
export const mockPL = {
  month: 'April 2025',
  departments: [
    { dept_id: 'dept-001', name: 'Engineering', revenue: 52400, expenses: 24000, profit: 28400 },
    { dept_id: 'dept-002', name: 'Sales',        revenue: 31200, expenses: 12100, profit: 19100 },
    { dept_id: 'dept-003', name: 'Operations',   revenue: 600,   expenses: 5400,  profit: -4800 },
  ],
  totals: { revenue: 84200, expenses: 41500, profit: 42700 },
  prior_month: { revenue: 75100, expenses: 39200, profit: 35900 },
}

// ─── Monthly revenue trend (last 6 months) ───────────────
export const mockRevenueTrend = [
  { month: 'Nov', revenue: 58000, expenses: 33000 },
  { month: 'Dec', revenue: 62000, expenses: 35000 },
  { month: 'Jan', revenue: 54000, expenses: 31000 },
  { month: 'Feb', revenue: 67000, expenses: 36000 },
  { month: 'Mar', revenue: 75100, expenses: 39200 },
  { month: 'Apr', revenue: 84200, expenses: 41500 },
]

// ─── Expense breakdown ────────────────────────────────────
export const mockExpenseBreakdown = [
  { category: 'Payroll',       amount: 31200, color: '#185FA5' },
  { category: 'Bill payments', amount: 4100,  color: '#854F0B' },
  { category: 'Infrastructure',amount: 2400,  color: '#534AB7' },
  { category: 'Subscriptions', amount: 1751,  color: '#0F6E56' },
  { category: 'Travel',        amount: 1200,  color: '#993C1D' },
  { category: 'Other',         amount: 849,   color: '#888780' },
]

// ── append to existing mockData exports ──────────────────

export const mockClients = [
  { id: 'cl-001', tenant_id: 'tenant-001', name: 'Beta Corp',     email: 'accounts@betacorp.com',  phone: '+92 300 1234567', address: '14 Business Park, Lahore',  city: 'Lahore',   country: 'PK', currency: 'USD', tax_number: 'NTN-1234567', is_active: true },
  { id: 'cl-002', tenant_id: 'tenant-001', name: 'Gamma Ltd',     email: 'finance@gammaltd.io',    phone: '+971 50 9876543', address: 'Suite 8, DIFC Tower, Dubai', city: 'Dubai',    country: 'AE', currency: 'USD', tax_number: '',            is_active: true },
  { id: 'cl-003', tenant_id: 'tenant-001', name: 'Delta Inc',     email: 'billing@deltainc.com',   phone: '+1 415 5550199',  address: '340 Pine St, San Francisco', city: 'San Francisco', country: 'US', currency: 'USD', tax_number: 'EIN-12-3456789', is_active: true },
  { id: 'cl-004', tenant_id: 'tenant-001', name: 'Omega Systems', email: 'ap@omegasys.net',        phone: '+44 20 79460011', address: '22 Finsbury Sq, London',    city: 'London',   country: 'GB', currency: 'GBP', tax_number: 'VAT-GB123456', is_active: true },
  { id: 'cl-005', tenant_id: 'tenant-001', name: 'Apex Co',       email: 'invoices@apexco.pk',     phone: '+92 21 3456789',  address: 'Block 5, Clifton, Karachi',  city: 'Karachi',  country: 'PK', currency: 'PKR', tax_number: 'NTN-9876543', is_active: true },
  { id: 'cl-006', tenant_id: 'tenant-001', name: 'Nova Tech',     email: 'finance@novatech.io',    phone: '+92 42 1234567',  address: '67 Gulberg III, Lahore',    city: 'Lahore',   country: 'PK', currency: 'USD', tax_number: 'NTN-5555555', is_active: true },
]

export const mockFullInvoices = [
  {
    id: 'inv-full-001', tenant_id: 'tenant-001', dept_id: 'dept-002', client_id: 'cl-001',
    type: 'invoice', status: 'paid', number: 'INV-2025-0044',
    issue_date: '2025-03-25', due_date: '2025-04-10', currency: 'USD',
    client_name: 'Beta Corp', client_email: 'accounts@betacorp.com', client_address: '14 Business Park, Lahore',
    notes: 'Thank you for your business.', terms: 'Payment due within 15 days.',
    discount_type: 'percent', discount_value: 5, discount_amount: 200,
    subtotal: 4000, tax_amount: 400, total: 4200, amount_paid: 4200,
    items: [
      { id:'item-001', sort_order:0, description:'Web development — Phase 1', quantity:40, unit_price:80, discount_pct:0,  tax_pct:10, line_total:3200, discount_amt:0,   taxable_amt:3200, tax_amt:320, net_total:3520 },
      { id:'item-002', sort_order:1, description:'UI/UX design',              quantity:8,  unit_price:100,discount_pct:0,  tax_pct:10, line_total:800,  discount_amt:0,   taxable_amt:800,  tax_amt:80,  net_total:880  },
    ],
    payments: [{ id:'pay-001', amount:4200, method:'bank_transfer', reference:'TXN-8821', payment_date:'2025-04-09', note:'' }],
    created_at: '2025-03-25T10:00:00Z', updated_at: '2025-04-09T14:22:00Z',
  },
  {
    id: 'inv-full-002', tenant_id: 'tenant-001', dept_id: 'dept-001', client_id: 'cl-002',
    type: 'invoice', status: 'pending', number: 'INV-2025-0043',
    issue_date: '2025-04-01', due_date: '2025-04-20', currency: 'USD',
    client_name: 'Gamma Ltd', client_email: 'finance@gammaltd.io', client_address: 'Suite 8, DIFC Tower, Dubai',
    notes: '', terms: 'Net 20.',
    discount_type: 'percent', discount_value: 0, discount_amount: 0,
    subtotal: 2545, tax_amount: 254.5, total: 2799.50, amount_paid: 0,
    items: [
      { id:'item-003', sort_order:0, description:'API integration — Stripe',   quantity:16, unit_price:120, discount_pct:0, tax_pct:10, line_total:1920, discount_amt:0, taxable_amt:1920, tax_amt:192, net_total:2112 },
      { id:'item-004', sort_order:1, description:'Technical documentation',    quantity:5,  unit_price:85,  discount_pct:0, tax_pct:10, line_total:425,  discount_amt:0, taxable_amt:425,  tax_amt:42.5,net_total:467.5},
      { id:'item-005', sort_order:2, description:'Code review & QA',           quantity:2,  unit_price:100, discount_pct:0, tax_pct:10, line_total:200,  discount_amt:0, taxable_amt:200,  tax_amt:20,  net_total:220  },
    ],
    payments: [],
    created_at: '2025-04-01T09:00:00Z', updated_at: '2025-04-01T09:00:00Z',
  },
  {
    id: 'inv-full-003', tenant_id: 'tenant-001', dept_id: 'dept-002', client_id: 'cl-003',
    type: 'invoice', status: 'overdue', number: 'INV-2025-0041',
    issue_date: '2025-03-20', due_date: '2025-04-04', currency: 'USD',
    client_name: 'Delta Inc', client_email: 'billing@deltainc.com', client_address: '340 Pine St, San Francisco',
    notes: 'Please remit by due date to avoid late fees.', terms: 'Net 15.',
    discount_type: 'fixed', discount_value: 100, discount_amount: 100,
    subtotal: 5200, tax_amount: 510, total: 5610, amount_paid: 0,
    items: [
      { id:'item-006', sort_order:0, description:'CRM customisation',           quantity:20, unit_price:200, discount_pct:0, tax_pct:10, line_total:4000, discount_amt:0, taxable_amt:4000, tax_amt:400, net_total:4400 },
      { id:'item-007', sort_order:1, description:'Data migration',              quantity:6,  unit_price:200, discount_pct:0, tax_pct:10, line_total:1200, discount_amt:0, taxable_amt:1200, tax_amt:120, net_total:1320 },
    ],
    payments: [],
    created_at: '2025-03-20T08:00:00Z', updated_at: '2025-03-20T08:00:00Z',
  },
  {
    id: 'inv-full-004', tenant_id: 'tenant-001', dept_id: 'dept-001', client_id: 'cl-006',
    type: 'invoice', status: 'draft', number: 'INV-2025-0045',
    issue_date: '2025-04-10', due_date: '2025-04-28', currency: 'USD',
    client_name: 'Nova Tech', client_email: 'finance@novatech.io', client_address: '67 Gulberg III, Lahore',
    notes: '', terms: 'Net 18.',
    discount_type: 'percent', discount_value: 0, discount_amount: 0,
    subtotal: 5727, tax_amount: 572.7, total: 6299.70, amount_paid: 0,
    items: [
      { id:'item-008', sort_order:0, description:'Cloud infrastructure setup — AWS', quantity:1, unit_price:3500, discount_pct:0, tax_pct:10, line_total:3500, discount_amt:0, taxable_amt:3500, tax_amt:350, net_total:3850 },
      { id:'item-009', sort_order:1, description:'DevOps pipeline configuration',    quantity:8, unit_price:227, discount_pct:0, tax_pct:10, line_total:1816, discount_amt:0, taxable_amt:1816, tax_amt:181.6,net_total:1997.6},
      { id:'item-010', sort_order:2, description:'Monitoring & alerting setup',       quantity:1, unit_price:411, discount_pct:0, tax_pct:10, line_total:411,  discount_amt:0, taxable_amt:411,  tax_amt:41.1, net_total:452.1},
    ],
    payments: [],
    created_at: '2025-04-10T11:00:00Z', updated_at: '2025-04-10T11:00:00Z',
  },
]

export const mockQuotations = [
  {
    id: 'quo-001', tenant_id: 'tenant-001', dept_id: 'dept-001', client_id: 'cl-005',
    type: 'quotation', status: 'sent', number: 'QUO-2025-0008',
    issue_date: '2025-04-05', due_date: '2025-04-19', currency: 'USD',
    client_name: 'Apex Co', client_email: 'invoices@apexco.pk', client_address: 'Block 5, Clifton, Karachi',
    notes: 'Quotation valid for 14 days.', terms: '',
    discount_type: 'percent', discount_value: 10, discount_amount: 350,
    subtotal: 3500, tax_amount: 315, total: 3465, amount_paid: 0,
    items: [
      { id:'qi-001', sort_order:0, description:'Mobile app development — MVP', quantity:35, unit_price:100, discount_pct:0, tax_pct:10, line_total:3500, discount_amt:0, taxable_amt:3500, tax_amt:350, net_total:3850 },
    ],
    payments: [],
    created_at: '2025-04-05T10:00:00Z', updated_at: '2025-04-05T10:00:00Z',
  },
  {
    id: 'quo-002', tenant_id: 'tenant-001', dept_id: 'dept-002', client_id: 'cl-004',
    type: 'quotation', status: 'accepted', number: 'QUO-2025-0007',
    issue_date: '2025-04-02', due_date: '2025-04-16', currency: 'GBP',
    client_name: 'Omega Systems', client_email: 'ap@omegasys.net', client_address: '22 Finsbury Sq, London',
    notes: '', terms: 'Quotation valid for 14 days.',
    discount_type: 'percent', discount_value: 0, discount_amount: 0,
    subtotal: 8400, tax_amount: 0, total: 8400, amount_paid: 0,
    items: [
      { id:'qi-002', sort_order:0, description:'ERP integration — SAP connector',  quantity:60, unit_price:140, discount_pct:0, tax_pct:0, line_total:8400, discount_amt:0, taxable_amt:8400, tax_amt:0, net_total:8400 },
    ],
    payments: [],
    created_at: '2025-04-02T09:00:00Z', updated_at: '2025-04-03T14:00:00Z',
  },
]

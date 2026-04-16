const router = require('express').Router()
const { v4: uuid } = require('uuid')
const db     = require('../db')
const { requirePermission } = require('../middleware/auth')

// GET /clients
router.get('/', requirePermission('clients','read'), async (req, res) => {
  try {
    const { search, page = 1, limit = 50, include_inactive } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    let q = db('clients').where({ tenant_id: req.tenant.id }).orderBy('name').limit(parseInt(limit)).offset(offset)
    if (!include_inactive) q.where({ is_active: true })
    if (search) q.whereILike('name', `%${search}%`)
    const [rows, [{ count }]] = await Promise.all([q, db('clients').where({ tenant_id: req.tenant.id }).count('id as count').first()])
    const ids = rows.map(r => r.id)
    const invCounts = ids.length ? await db('invoices').whereIn('client_id', ids).where({ type:'invoice' }).select('client_id').count('id as count').groupBy('client_id') : []
    const cmap = Object.fromEntries(invCounts.map(r => [r.client_id, parseInt(r.count)]))
    res.json({ data: rows.map(r => ({ ...r, invoice_count: cmap[r.id] ?? 0 })), total: parseInt(count), page: parseInt(page), limit: parseInt(limit) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /clients/:id
router.get('/:id', requirePermission('clients','read'), async (req, res) => {
  try {
    const client = await db('clients').where({ id: req.params.id, tenant_id: req.tenant.id }).first()
    if (!client) return res.status(404).json({ error: 'Client not found' })
    const invoices = await db('invoices').where({ client_id: client.id, tenant_id: req.tenant.id, type:'invoice' }).select('id','number','status','total','amount_paid','issue_date','due_date','currency').orderBy('created_at','desc').limit(20)
    const stats = await db('invoices').where({ client_id: client.id, tenant_id: req.tenant.id, type:'invoice' }).select(db.raw('COUNT(*) as total_invoices'), db.raw('COALESCE(SUM(total),0) as total_billed'), db.raw('COALESCE(SUM(amount_paid),0) as total_paid'), db.raw('COALESCE(SUM(total-amount_paid),0) as total_outstanding')).first()
    res.json({ ...client, invoices, stats })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /clients
router.post('/', requirePermission('clients','write'), async (req, res) => {
  try {
    const { name, email, phone, address, city, country, tax_number, currency, notes } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Client name is required' })
    const [client] = await db('clients').insert({ id: uuid(), tenant_id: req.tenant.id, name: name.trim(), email: email||null, phone: phone||null, address: address||null, city: city||null, country: country||null, tax_number: tax_number||null, currency: currency||'USD', notes: notes||null }).returning('*')
    res.status(201).json(client)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// PUT /clients/:id
router.put('/:id', requirePermission('clients','write'), async (req, res) => {
  try {
    const { name, email, phone, address, city, country, tax_number, currency, notes } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Client name is required' })
    const [client] = await db('clients').where({ id: req.params.id, tenant_id: req.tenant.id }).update({ name: name.trim(), email, phone, address, city, country, tax_number, currency, notes }).returning('*')
    if (!client) return res.status(404).json({ error: 'Not found' })
    res.json(client)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// DELETE /clients/:id
router.delete('/:id', requirePermission('clients','delete'), async (req, res) => {
  try {
    const client = await db('clients').where({ id: req.params.id, tenant_id: req.tenant.id }).first()
    if (!client) return res.status(404).json({ error: 'Not found' })
    const open = await db('invoices').where({ client_id: client.id, tenant_id: req.tenant.id }).whereNotIn('status', ['paid','cancelled','converted']).count('id as count').first()
    if (parseInt(open.count) > 0) return res.status(400).json({ error: `Client has ${open.count} open invoice(s) — cannot delete` })
    await db('clients').where({ id: client.id }).update({ is_active: false })
    res.json({ message: 'Client archived' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

const router = require('express').Router()
const { v4: uuid } = require('uuid')
const db     = require('../db')
const { calcInvoice }       = require('../services/invoiceCalculator')
const { requirePermission } = require('../middleware/auth')

async function nextNumber(tenantId, type, trx) {
  const [{ next_invoice_number }] = await (trx || db).raw(
    `SELECT next_invoice_number(?, ?) AS next_invoice_number`, [tenantId, type]
  )
  return next_invoice_number
}

// GET /quotations
router.get('/', requirePermission('invoices','read'), async (req, res) => {
  try {
    const { status, page = 1, limit = 25, search } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    let q = db('invoices as i')
      .join('departments as d','d.id','i.dept_id')
      .where({ 'i.tenant_id': req.tenant.id, 'i.type': 'quotation' })
      .select('i.id','i.number','i.status','i.issue_date','i.due_date',
              'i.currency','i.total','i.client_name','i.updated_at',
              'd.name as dept_name','d.code as dept_code')
      .orderBy('i.created_at','desc')
      .limit(parseInt(limit)).offset(offset)

    if (status) q.where('i.status', status)
    if (search) q.whereILike('i.client_name', `%${search}%`)

    const rows = await q
    res.json({ data: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /quotations/:id
router.get('/:id', requirePermission('invoices','read'), async (req, res) => {
  try {
    const quote = await db('invoices').where({ id: req.params.id, tenant_id: req.tenant.id, type: 'quotation' }).first()
    if (!quote) return res.status(404).json({ error: 'Not found' })
    const items = await db('invoice_items').where({ invoice_id: quote.id }).orderBy('sort_order')
    res.json({ ...quote, items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /quotations
router.post('/', requirePermission('invoices','write'), async (req, res) => {
  const trx = await db.transaction()
  try {
    const { dept_id, client_id, issue_date, due_date, currency = 'USD',
            notes, terms, items = [], discount_type = 'percent', discount_value = 0 } = req.body

    const client = await trx('clients').where({ id: client_id, tenant_id: req.tenant.id }).first()
    if (!client) throw new Error('Client not found')

    const calc   = calcInvoice(items, { type: discount_type, value: discount_value })
    const number = await nextNumber(req.tenant.id, 'quotation', trx)

    const [quote] = await trx('invoices').insert({
      id: uuid(), tenant_id: req.tenant.id, dept_id, client_id,
      type: 'quotation', status: 'draft', number,
      issue_date, due_date, currency,
      client_name: client.name, client_email: client.email, client_address: client.address,
      notes, terms, discount_type, discount_value,
      discount_amount: calc.discount_amount,
      subtotal: calc.subtotal, tax_amount: calc.tax_amount, total: calc.total,
      amount_paid: 0,
      created_by: req.user.id,
    }).returning('*')

    if (calc.items.length) {
      await trx('invoice_items').insert(
        calc.items.map((item, i) => ({ id: uuid(), invoice_id: quote.id, sort_order: i, ...item }))
      )
    }

    await trx.commit()
    res.status(201).json(quote)
  } catch (err) {
    await trx.rollback()
    res.status(400).json({ error: err.message })
  }
})

// POST /quotations/:id/convert  — convert quotation → invoice
router.post('/:id/convert', requirePermission('invoices','write'), async (req, res) => {
  const trx = await db.transaction()
  try {
    const quote = await trx('invoices').where({ id: req.params.id, tenant_id: req.tenant.id, type: 'quotation' }).first()
    if (!quote) throw new Error('Quotation not found')
    if (!['accepted','sent','draft'].includes(quote.status)) throw new Error(`Cannot convert a ${quote.status} quotation`)

    const items  = await trx('invoice_items').where({ invoice_id: quote.id }).orderBy('sort_order')
    const number = await nextNumber(req.tenant.id, 'invoice', trx)

    const [invoice] = await trx('invoices').insert({
      id: uuid(), tenant_id: req.tenant.id,
      dept_id: quote.dept_id, client_id: quote.client_id,
      type: 'invoice', status: 'draft', number,
      converted_from: quote.id,
      issue_date: new Date(), due_date: quote.due_date,
      currency: quote.currency,
      client_name: quote.client_name, client_email: quote.client_email, client_address: quote.client_address,
      notes: quote.notes, terms: quote.terms,
      discount_type: quote.discount_type, discount_value: quote.discount_value,
      discount_amount: quote.discount_amount,
      subtotal: quote.subtotal, tax_amount: quote.tax_amount, total: quote.total,
      amount_paid: 0,
      created_by: req.user.id,
    }).returning('*')

    // Clone items
    if (items.length) {
      await trx('invoice_items').insert(
        items.map(item => ({ ...item, id: uuid(), invoice_id: invoice.id }))
      )
    }

    // Mark quotation as converted
    await trx('invoices').where({ id: quote.id }).update({ status: 'converted' })

    await trx.commit()
    res.status(201).json({ invoice, converted_from: quote.id })
  } catch (err) {
    await trx.rollback()
    res.status(400).json({ error: err.message })
  }
})

// PATCH /quotations/:id/status  — accept / reject / send
router.patch('/:id/status', requirePermission('invoices','write'), async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['sent','accepted','rejected']
    if (!allowed.includes(status)) return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` })

    const quote = await db('invoices').where({ id: req.params.id, tenant_id: req.tenant.id, type: 'quotation' }).first()
    if (!quote) return res.status(404).json({ error: 'Not found' })

    await db('invoices').where({ id: quote.id }).update({ status })
    res.json({ message: `Quotation marked as ${status}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

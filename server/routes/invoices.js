const router = require('express').Router()
const { v4: uuid } = require('uuid')
const db      = require('../db')
const { calcInvoice } = require('../services/invoiceCalculator')
const { requirePermission } = require('../middleware/auth')

// ─── helpers ─────────────────────────────────────────────
async function nextNumber(tenantId, type, trx) {
  const res = await (trx || db).raw(
    `SELECT next_invoice_number(?, ?) AS num`, [tenantId, type]
  )
  return res.rows[0].num
}

async function getInvoiceOr404(id, tenantId, trx) {
  const inv = await (trx || db)('invoices').where({ id, tenant_id: tenantId }).first()
  return inv
}

// ─── GET /invoices ────────────────────────────────────────
router.get('/', requirePermission('invoices','read'), async (req, res) => {
  try {
    const { status, dept_id, client_id, from, to, search, type = 'invoice', page = 1, limit = 25 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    let q = db('invoices as i')
      .leftJoin('clients as c',    'c.id', 'i.client_id')
      .leftJoin('departments as d','d.id', 'i.dept_id')
      .where({ 'i.tenant_id': req.tenant.id, 'i.type': type })
      .select(
        'i.id','i.number','i.type','i.status','i.issue_date','i.due_date',
        'i.currency','i.subtotal','i.total','i.amount_paid','i.client_name',
        'i.client_email','i.pdf_source','i.created_at','i.updated_at',
        'c.id as client_id',
        'd.name as dept_name','d.code as dept_code'
      )
      .orderBy('i.created_at','desc')
      .limit(parseInt(limit)).offset(offset)

    if (status)    q.where('i.status',    status)
    if (dept_id)   q.where('i.dept_id',   dept_id)
    if (client_id) q.where('i.client_id', client_id)
    if (from)      q.where('i.issue_date','>=', from)
    if (to)        q.where('i.issue_date','<=', to)
    if (search)    q.where(b => b.whereILike('i.client_name','%'+search+'%').orWhereILike('i.number','%'+search+'%'))

    const [rows, countRes] = await Promise.all([
      q,
      db('invoices').where({ tenant_id: req.tenant.id, type }).count('id as count').first(),
    ])

    // Computed amount_due
    const data = rows.map(r => ({ ...r, amount_due: (parseFloat(r.total) - parseFloat(r.amount_paid)).toFixed(2) }))
    res.json({ data, total: parseInt(countRes.count), page: parseInt(page), limit: parseInt(limit) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── GET /invoices/summary ─────────────────────────────────
router.get('/summary', requirePermission('invoices','read'), async (req, res) => {
  try {
    const r = await db('invoices')
      .where({ tenant_id: req.tenant.id, type: 'invoice' })
      .whereNotIn('status', ['cancelled'])
      .select(
        db.raw('COALESCE(SUM(total),0) as total_invoiced'),
        db.raw('COALESCE(SUM(amount_paid),0) as total_paid'),
        db.raw('COALESCE(SUM(CASE WHEN status=\'overdue\' THEN total-amount_paid ELSE 0 END),0) as total_overdue'),
        db.raw('COUNT(*) as count'),
      ).first()
    res.json(r)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── GET /invoices/:id ────────────────────────────────────
router.get('/:id', requirePermission('invoices','read'), async (req, res) => {
  try {
    const invoice = await db('invoices as i')
      .leftJoin('clients as c',    'c.id', 'i.client_id')
      .leftJoin('departments as d','d.id', 'i.dept_id')
      .where({ 'i.id': req.params.id, 'i.tenant_id': req.tenant.id })
      .select('i.*','c.phone as c_phone','c.tax_number as c_tax','d.name as dept_name','d.code as dept_code')
      .first()

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    const [items, payments] = await Promise.all([
      db('invoice_items as ii')
        .leftJoin('departments as d','d.id','ii.dept_id')
        .where({ invoice_id: invoice.id })
        .select('ii.*','d.name as dept_name','d.code as dept_code')
        .orderBy('sort_order'),
      db('payments').where({ invoice_id: invoice.id }).orderBy('payment_date'),
    ])

    // Auto mark sent → viewed
    if (invoice.status === 'sent' && !invoice.viewed_at) {
      await db('invoices').where({ id: invoice.id }).update({ status:'viewed', viewed_at: new Date() })
      invoice.status   = 'viewed'
      invoice.viewed_at = new Date()
    }

    res.json({ ...invoice, items, payments, amount_due: (parseFloat(invoice.total) - parseFloat(invoice.amount_paid)).toFixed(2) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── POST /invoices — create (from PDF upload) ────────────
router.post('/', requirePermission('invoices','write'), async (req, res) => {
  const trx = await db.transaction()
  try {
    const {
      client_id, dept_id, issue_date, due_date, currency = 'USD',
      notes, terms, reference, pdf_source,
      items = [],
      discount_type = 'percent', discount_value = 0,
    } = req.body

    const client = await trx('clients').where({ id: client_id, tenant_id: req.tenant.id }).first()
    if (!client) throw new Error('Client not found')

    const calc   = calcInvoice(items, { type: discount_type, value: discount_value })
    const number = await nextNumber(req.tenant.id, 'invoice', trx)

    const [invoice] = await trx('invoices').insert({
      id: uuid(), tenant_id: req.tenant.id,
      dept_id:     dept_id || items[0]?.dept_id || null,
      client_id,
      type: 'invoice', status: 'draft', number, reference, pdf_source,
      issue_date:  issue_date || new Date(),
      due_date:    due_date   || null,
      currency,
      client_name:    client.name,
      client_email:   client.email,
      client_address: client.address,
      notes, terms,
      discount_type, discount_value,
      discount_amount: calc.discount_amount,
      subtotal:   calc.subtotal,
      tax_amount: calc.tax_amount,
      total:      calc.total,
      amount_paid: 0,
      created_by: req.user.id,
    }).returning('*')

    if (calc.items.length) {
      await trx('invoice_items').insert(
        calc.items.map((item, i) => ({
          id: uuid(), invoice_id: invoice.id,
          dept_id: item.dept_id || null,
          sort_order: i,
          description:  item.description,
          quantity:     item.quantity,
          unit_price:   item.unit_price,
          discount_pct: item.discount_pct,
          tax_pct:      item.tax_pct,
          line_total:   item.line_total,
          discount_amt: item.discount_amt,
          taxable_amt:  item.taxable_amt,
          tax_amt:      item.tax_amt,
          net_total:    item.net_total,
        }))
      )
    }

    await trx.commit()
    res.status(201).json(invoice)
  } catch (err) {
    await trx.rollback()
    res.status(400).json({ error: err.message })
  }
})

// ─── PUT /invoices/:id ────────────────────────────────────
router.put('/:id', requirePermission('invoices','write'), async (req, res) => {
  const trx = await db.transaction()
  try {
    const invoice = await getInvoiceOr404(req.params.id, req.tenant.id, trx)
    if (!invoice) throw new Error('Invoice not found')
    if (['paid','cancelled'].includes(invoice.status)) throw new Error('Cannot edit paid or cancelled invoice')

    const { dept_id, client_id, issue_date, due_date, currency, notes, terms, reference,
            items = [], discount_type, discount_value } = req.body

    const calc = calcInvoice(items, {
      type:  discount_type  ?? invoice.discount_type,
      value: discount_value ?? invoice.discount_value,
    })

    let snap = {}
    if (client_id && client_id !== invoice.client_id) {
      const c = await trx('clients').where({ id: client_id, tenant_id: req.tenant.id }).first()
      if (!c) throw new Error('Client not found')
      snap = { client_name: c.name, client_email: c.email, client_address: c.address }
    }

    await trx('invoices').where({ id: invoice.id }).update({
      dept_id, client_id, issue_date, due_date, currency, notes, terms, reference,
      discount_type, discount_value,
      discount_amount: calc.discount_amount,
      subtotal: calc.subtotal, tax_amount: calc.tax_amount, total: calc.total,
      ...snap,
    })

    await trx('invoice_items').where({ invoice_id: invoice.id }).delete()
    if (calc.items.length) {
      await trx('invoice_items').insert(
        calc.items.map((item, i) => ({
          id: uuid(), invoice_id: invoice.id,
          dept_id: item.dept_id || null,
          sort_order: i,
          description: item.description, quantity: item.quantity,
          unit_price: item.unit_price, discount_pct: item.discount_pct, tax_pct: item.tax_pct,
          line_total: item.line_total, discount_amt: item.discount_amt,
          taxable_amt: item.taxable_amt, tax_amt: item.tax_amt, net_total: item.net_total,
        }))
      )
    }

    await trx.commit()
    const updated = await db('invoices').where({ id: invoice.id }).first()
    res.json(updated)
  } catch (err) {
    await trx.rollback()
    res.status(400).json({ error: err.message })
  }
})

// ─── POST /invoices/:id/send ──────────────────────────────
router.post('/:id/send', requirePermission('invoices','write'), async (req, res) => {
  try {
    const invoice = await getInvoiceOr404(req.params.id, req.tenant.id)
    if (!invoice) return res.status(404).json({ error: 'Not found' })
    if (!['draft','viewed'].includes(invoice.status))
      return res.status(400).json({ error: `Cannot send invoice with status "${invoice.status}"` })

    await db('invoices').where({ id: invoice.id }).update({ status:'sent', sent_at: new Date() })
    // TODO: integrate email service
    res.json({ message:'Invoice marked as sent', sent_at: new Date() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── POST /invoices/:id/payments ─────────────────────────
router.post('/:id/payments', requirePermission('invoices','write'), async (req, res) => {
  const trx = await db.transaction()
  try {
    const invoice = await getInvoiceOr404(req.params.id, req.tenant.id, trx)
    if (!invoice) throw new Error('Invoice not found')
    if (invoice.status === 'cancelled') throw new Error('Cannot add payment to cancelled invoice')

    const { amount, method = 'bank_transfer', reference, note, payment_date } = req.body
    const pay = parseFloat(amount)
    if (isNaN(pay) || pay <= 0) throw new Error('Invalid amount')

    const due = parseFloat(invoice.total) - parseFloat(invoice.amount_paid)
    if (pay > due + 0.01) throw new Error(`Payment $${pay} exceeds amount due $${due.toFixed(2)}`)

    const [payment] = await trx('payments').insert({
      id: uuid(), tenant_id: req.tenant.id,
      invoice_id: invoice.id, amount: pay, method, reference, note,
      payment_date: payment_date || new Date(),
      recorded_by: req.user.id,
    }).returning('*')

    const newPaid   = parseFloat(invoice.amount_paid) + pay
    const newStatus = newPaid >= parseFloat(invoice.total) - 0.01 ? 'paid' : 'partial'

    await trx('invoices').where({ id: invoice.id }).update({
      amount_paid: newPaid,
      status: newStatus,
      paid_at: newStatus === 'paid' ? new Date() : invoice.paid_at,
    })

    await trx.commit()
    res.status(201).json({ payment, new_status: newStatus, amount_paid: newPaid })
  } catch (err) {
    await trx.rollback()
    res.status(400).json({ error: err.message })
  }
})

// ─── DELETE /invoices/:id — soft delete (cancel) ──────────
router.delete('/:id', requirePermission('invoices','delete'), async (req, res) => {
  try {
    const invoice = await getInvoiceOr404(req.params.id, req.tenant.id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (invoice.status === 'paid')
      return res.status(400).json({ error: 'Cannot delete a fully paid invoice' })

    await db('invoices').where({ id: invoice.id }).update({ status: 'cancelled' })
    res.json({ message: 'Invoice cancelled', id: invoice.id })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

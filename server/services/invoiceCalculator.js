/**
 * invoiceCalculator.js
 * Pure calculation functions — used by both frontend and backend.
 * Backend ALWAYS recalculates; frontend uses for real-time display.
 */

/**
 * Calculate a single line item.
 * @param {Object} item - { quantity, unit_price, discount_pct, tax_pct }
 * @returns {Object} - enriched item with all computed fields
 */
function calcItem(item) {
  const qty          = parseFloat(item.quantity)   || 0
  const unitPrice    = parseFloat(item.unit_price) || 0
  const discountPct  = parseFloat(item.discount_pct) || 0
  const taxPct       = parseFloat(item.tax_pct)    || 0

  const line_total   = round2(qty * unitPrice)
  const discount_amt = round2(line_total * discountPct / 100)
  const taxable_amt  = round2(line_total - discount_amt)
  const tax_amt      = round2(taxable_amt * taxPct / 100)
  const net_total    = round2(taxable_amt + tax_amt)

  return {
    ...item,
    line_total,
    discount_amt,
    taxable_amt,
    tax_amt,
    net_total,
  }
}

/**
 * Calculate invoice totals from line items + global discount.
 * @param {Array}  items          - array of raw line items
 * @param {Object} globalDiscount - { type: 'percent'|'fixed', value: number }
 * @returns {Object} - { items, subtotal, discount_amount, tax_amount, total }
 */
function calcInvoice(items = [], globalDiscount = { type: 'percent', value: 0 }) {
  const calcedItems = items.map(calcItem)

  // Subtotal = sum of taxable amounts (after line discounts, before line tax)
  const subtotal   = round2(calcedItems.reduce((s, i) => s + i.taxable_amt, 0))
  const tax_amount = round2(calcedItems.reduce((s, i) => s + i.tax_amt,     0))

  // Global discount applied to subtotal
  let discount_amount = 0
  if (globalDiscount.type === 'percent') {
    discount_amount = round2(subtotal * (parseFloat(globalDiscount.value) || 0) / 100)
  } else {
    discount_amount = round2(parseFloat(globalDiscount.value) || 0)
  }

  const total = round2(subtotal - discount_amount + tax_amount)

  return {
    items:           calcedItems,
    subtotal,
    discount_amount,
    tax_amount,
    total: Math.max(total, 0),
  }
}

/**
 * Determine if an invoice is overdue.
 */
function isOverdue(invoice) {
  if (!invoice.due_date) return false
  if (['paid','cancelled','converted'].includes(invoice.status)) return false
  return new Date(invoice.due_date) < new Date(new Date().toDateString())
}

/**
 * Compute payment status given total + amount_paid.
 */
function paymentStatus(total, amountPaid) {
  if (amountPaid <= 0)     return 'unpaid'
  if (amountPaid >= total) return 'paid'
  return 'partial'
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

module.exports = { calcItem, calcInvoice, isOverdue, paymentStatus, round2 }

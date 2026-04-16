// Mirrors server/services/invoiceCalculator.js exactly.
// Both must stay in sync. Server always recalculates on save.

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function calcItem(item) {
  const qty         = parseFloat(item.quantity)    || 0
  const unitPrice   = parseFloat(item.unit_price)  || 0
  const discountPct = parseFloat(item.discount_pct)|| 0
  const taxPct      = parseFloat(item.tax_pct)     || 0

  const line_total   = round2(qty * unitPrice)
  const discount_amt = round2(line_total * discountPct / 100)
  const taxable_amt  = round2(line_total - discount_amt)
  const tax_amt      = round2(taxable_amt * taxPct / 100)
  const net_total    = round2(taxable_amt + tax_amt)

  return { ...item, line_total, discount_amt, taxable_amt, tax_amt, net_total }
}

export function calcInvoice(items = [], globalDiscount = { type: 'percent', value: 0 }) {
  const calcedItems = items.map(calcItem)
  const subtotal    = round2(calcedItems.reduce((s, i) => s + i.taxable_amt, 0))
  const tax_amount  = round2(calcedItems.reduce((s, i) => s + i.tax_amt,     0))

  let discount_amount = 0
  if (globalDiscount.type === 'percent') {
    discount_amount = round2(subtotal * (parseFloat(globalDiscount.value) || 0) / 100)
  } else {
    discount_amount = round2(parseFloat(globalDiscount.value) || 0)
  }

  const total = round2(Math.max(subtotal - discount_amount + tax_amount, 0))
  return { items: calcedItems, subtotal, discount_amount, tax_amount, total }
}

export function emptyItem() {
  return {
    _id:          crypto.randomUUID(),
    description:  '',
    quantity:     1,
    unit_price:   0,
    discount_pct: 0,
    tax_pct:      0,
    line_total:   0,
    discount_amt: 0,
    taxable_amt:  0,
    tax_amt:      0,
    net_total:    0,
  }
}

export const CURRENCIES = [
  { code:'USD', symbol:'$',  name:'US Dollar'    },
  { code:'GBP', symbol:'£',  name:'British Pound' },
  { code:'EUR', symbol:'€',  name:'Euro'          },
  { code:'AED', symbol:'د.إ',name:'UAE Dirham'    },
  { code:'PKR', symbol:'₨',  name:'Pakistani Rupee'},
  { code:'SAR', symbol:'﷼',  name:'Saudi Riyal'   },
]

export function getCurrencySymbol(code) {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}

export const STATUS_META = {
  draft:     { label:'Draft',     cls:'pill-gray',   },
  sent:      { label:'Sent',      cls:'pill-blue',   },
  viewed:    { label:'Viewed',    cls:'pill-purple',  },
  paid:      { label:'Paid',      cls:'pill-green',  },
  partial:   { label:'Partial',   cls:'pill-teal',   },
  overdue:   { label:'Overdue',   cls:'pill-red',    },
  cancelled: { label:'Cancelled', cls:'pill-gray',   },
  accepted:  { label:'Accepted',  cls:'pill-green',  },
  rejected:  { label:'Rejected',  cls:'pill-red',    },
  converted: { label:'Converted', cls:'pill-purple', },
}

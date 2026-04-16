import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, StatusPill } from '../../components/ui/index'
import { useToast } from '../../context/ToastContext'
import { mockFullInvoices, mockClients } from '../../lib/mockInvoiceData'
import { mockDepartments } from '../../lib/mockData'
import { formatDate, formatCurrency } from '../../lib/format'
import { getCurrencySymbol, STATUS_META } from '../../lib/invoiceCalc'
import styles from './InvoiceView.module.css'

const COMPANY = {
  name: 'Acme Technologies',
  address: '14 Main Boulevard, Gulberg III',
  city: 'Lahore, Punjab 54000, Pakistan',
  email: 'billing@acmetechnologies.io',
  phone: '+92 42 111 000 222',
  taxNo: 'NTN-1234567',
}

// ─── Payment modal ────────────────────────────────────────
function PaymentModal({ invoice, onRecord, onClose }) {
  const remaining = invoice.total - invoice.amount_paid
  const [amount,  setAmount]  = useState(remaining.toFixed(2))
  const [method,  setMethod]  = useState('bank_transfer')
  const [ref,     setRef]     = useState('')
  const [date,    setDate]    = useState(new Date().toISOString().slice(0,10))
  const [note,    setNote]    = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onRecord({ amount: parseFloat(amount), method, reference: ref, payment_date: date, note })
    onClose()
  }

  const sym = getCurrencySymbol(invoice.currency)

  return (
    <Modal title="Record payment" onClose={onClose} footer={
      <>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="pay-form" type="submit">Record payment</button>
      </>
    }>
      <form id="pay-form" onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ background:'var(--bg-muted)', borderRadius:'var(--r-md)', padding:'10px 14px', fontSize:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ color:'var(--text-secondary)' }}>Invoice total</span>
            <span style={{ fontWeight:500 }}>{sym}{Number(invoice.total).toLocaleString('en-US',{minimumFractionDigits:2})}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
            <span style={{ color:'var(--text-secondary)' }}>Amount due</span>
            <span style={{ fontWeight:500, color:'var(--blue-600)' }}>{sym}{remaining.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
          </div>
        </div>

        <div className="field">
          <label className="label">Amount *</label>
          <input className="input" type="number" required min="0.01" step="0.01" max={remaining}
            value={amount} onChange={e => setAmount(e.target.value)}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="field">
            <label className="label">Payment method</label>
            <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Payment date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)}/>
          </div>
        </div>
        <div className="field">
          <label className="label">Reference / transaction ID</label>
          <input className="input" placeholder="e.g. TXN-12345" value={ref} onChange={e => setRef(e.target.value)}/>
        </div>
        <div className="field">
          <label className="label">Note</label>
          <input className="input" placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)}/>
        </div>
      </form>
    </Modal>
  )
}

// ─── Printable invoice document ──────────────────────────
function InvoiceDocument({ invoice, dept }) {
  const sym = getCurrencySymbol(invoice.currency)
  const fmt = n => sym + Number(n).toLocaleString('en-US', { minimumFractionDigits:2 })
  const amountDue = invoice.total - invoice.amount_paid

  return (
    <div className={styles.document} id="invoice-document">
      {/* Header */}
      <div className={styles.docHeader}>
        <div className={styles.docCompany}>
          <div className={styles.docLogo}>B</div>
          <div>
            <div className={styles.docCompanyName}>{COMPANY.name}</div>
            <div className={styles.docCompanyMeta}>{COMPANY.address}</div>
            <div className={styles.docCompanyMeta}>{COMPANY.city}</div>
            <div className={styles.docCompanyMeta}>{COMPANY.email} · {COMPANY.phone}</div>
            <div className={styles.docCompanyMeta}>Tax no: {COMPANY.taxNo}</div>
          </div>
        </div>
        <div className={styles.docMeta}>
          <div className={styles.docType}>{invoice.type === 'invoice' ? 'INVOICE' : 'QUOTATION'}</div>
          <div className={styles.docNumber}>{invoice.number}</div>
          <div className={styles.docMetaGrid}>
            <span className={styles.metaKey}>Issued</span>
            <span>{formatDate(invoice.issue_date)}</span>
            {invoice.due_date && <>
              <span className={styles.metaKey}>Due</span>
              <span style={{ color: invoice.status==='overdue' ? 'var(--red-600)' : 'inherit' }}>
                {formatDate(invoice.due_date)}
              </span>
            </>}
            <span className={styles.metaKey}>Department</span>
            <span>{dept?.name ?? '—'}</span>
            {invoice.reference && <>
              <span className={styles.metaKey}>Reference</span>
              <span>{invoice.reference}</span>
            </>}
          </div>
        </div>
      </div>

      <div className={styles.docDivider}/>

      {/* Bill to */}
      <div className={styles.billSection}>
        <div className={styles.billBox}>
          <div className={styles.billLabel}>Bill to</div>
          <div className={styles.billName}>{invoice.client_name}</div>
          {invoice.client_email   && <div className={styles.billMeta}>{invoice.client_email}</div>}
          {invoice.client_address && <div className={styles.billMeta}>{invoice.client_address}</div>}
        </div>
        {invoice.status !== 'draft' && (
          <div className={styles.statusStamp} data-status={invoice.status}>
            {STATUS_META[invoice.status]?.label?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Line items */}
      <table className={styles.itemsTable}>
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ textAlign:'right' }}>Qty</th>
            <th style={{ textAlign:'right' }}>Unit price</th>
            <th style={{ textAlign:'right' }}>Disc %</th>
            <th style={{ textAlign:'right' }}>Tax %</th>
            <th style={{ textAlign:'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, i) => (
            <tr key={item.id ?? i}>
              <td>{item.description}</td>
              <td style={{ textAlign:'right' }}>{Number(item.quantity)}</td>
              <td style={{ textAlign:'right' }}>{fmt(item.unit_price)}</td>
              <td style={{ textAlign:'right' }}>{item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}</td>
              <td style={{ textAlign:'right' }}>{item.tax_pct > 0 ? `${item.tax_pct}%` : '—'}</td>
              <td style={{ textAlign:'right', fontWeight:500 }}>{fmt(item.net_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className={styles.totalsSection}>
        <div className={styles.totalsBox}>
          <div className={styles.totalLine}>
            <span>Subtotal</span><span>{fmt(invoice.subtotal)}</span>
          </div>
          {Number(invoice.discount_amount) > 0 && (
            <div className={styles.totalLine}>
              <span>Discount</span><span>−{fmt(invoice.discount_amount)}</span>
            </div>
          )}
          {Number(invoice.tax_amount) > 0 && (
            <div className={styles.totalLine}>
              <span>Tax</span><span>{fmt(invoice.tax_amount)}</span>
            </div>
          )}
          <div className={`${styles.totalLine} ${styles.grandLine}`}>
            <span>Total</span><span>{fmt(invoice.total)}</span>
          </div>
          {Number(invoice.amount_paid) > 0 && (
            <div className={styles.totalLine} style={{ color:'var(--green-600)' }}>
              <span>Paid</span><span>{fmt(invoice.amount_paid)}</span>
            </div>
          )}
          {amountDue > 0 && (
            <div className={`${styles.totalLine} ${styles.dueAmountLine}`}>
              <span>Amount due</span><span>{fmt(amountDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes + Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className={styles.footerSection}>
          {invoice.notes && (
            <div>
              <div className={styles.footerLabel}>Notes</div>
              <div className={styles.footerText}>{invoice.notes}</div>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div className={styles.footerLabel}>Terms & conditions</div>
              <div className={styles.footerText}>{invoice.terms}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Payment history ─────────────────────────────────────
function PaymentHistory({ payments, currency }) {
  const sym = getCurrencySymbol(currency)
  if (!payments?.length) return null
  return (
    <div className="card">
      <div style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.04em' }}>
        Payment history
      </div>
      {payments.map(p => (
        <div key={p.id} className={styles.payRow}>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>{sym}{Number(p.amount).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
            <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{p.method?.replace('_',' ')} {p.reference ? `· ${p.reference}` : ''}</div>
          </div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', textAlign:'right' }}>
            {formatDate(p.payment_date)}
            {p.note && <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{p.note}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main view page ───────────────────────────────────────
export default function InvoiceView() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const toast      = useToast()
  const [showPay, setShowPay]   = useState(false)
  const [invoice, setInvoice]   = useState(() => mockFullInvoices.find(i => i.id === id))

  if (!invoice) return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar title="Invoice not found" />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <p style={{ color:'var(--text-secondary)', marginBottom:16 }}>This invoice does not exist or you don't have access.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/invoices')}>Back to invoices</button>
        </div>
      </div>
    </div>
  )

  const dept     = mockDepartments.find(d => d.id === invoice.dept_id)
  const amountDue = invoice.total - invoice.amount_paid
  const canPay   = !['paid','cancelled','draft'].includes(invoice.status) && amountDue > 0
  const canSend  = invoice.status === 'draft'
  const canEdit  = ['draft','sent'].includes(invoice.status)

  function handleSend() {
    setInvoice(inv => ({ ...inv, status:'sent', sent_at: new Date().toISOString() }))
    toast.success('Invoice marked as sent')
  }

  function handleRecord(payData) {
    const newPaid   = Number(invoice.amount_paid) + payData.amount
    const newStatus = newPaid >= Number(invoice.total) ? 'paid' : 'partial'
    setInvoice(inv => ({
      ...inv,
      amount_paid: newPaid,
      status: newStatus,
      payments: [...(inv.payments ?? []), { id: crypto.randomUUID(), ...payData }],
    }))
    toast.success('Payment recorded')
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar
        title={invoice.number}
        subtitle={invoice.client_name}
        actions={
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <StatusPill status={invoice.status}/>
            {canSend  && <button className="btn btn-secondary btn-sm" onClick={handleSend}>Mark as sent</button>}
            {canPay   && <button className="btn btn-primary btn-sm"   onClick={() => setShowPay(true)}>Record payment</button>}
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print / PDF
            </button>
          </div>
        }
      />

      <div className={styles.viewLayout}>
        <div className={styles.docCol}>
          <InvoiceDocument invoice={invoice} dept={dept} />
        </div>
        <div className={styles.actionCol}>
          {/* Amount due summary */}
          <div className="card">
            <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>
              {invoice.status === 'paid' ? 'Fully paid' : 'Amount due'}
            </div>
            <div style={{ fontSize:24, fontWeight:500, color: invoice.status==='paid' ? 'var(--green-600)' : 'var(--text-primary)' }}>
              {getCurrencySymbol(invoice.currency)}{amountDue > 0 ? amountDue.toLocaleString('en-US',{minimumFractionDigits:2}) : '0.00'}
            </div>
            {Number(invoice.amount_paid) > 0 && (
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>
                {getCurrencySymbol(invoice.currency)}{Number(invoice.amount_paid).toLocaleString('en-US',{minimumFractionDigits:2})} paid of {getCurrencySymbol(invoice.currency)}{Number(invoice.total).toLocaleString('en-US',{minimumFractionDigits:2})}
              </div>
            )}
            {canPay && (
              <button className="btn btn-primary" style={{ width:'100%', marginTop:12 }} onClick={() => setShowPay(true)}>
                Record payment
              </button>
            )}
          </div>

          <PaymentHistory payments={invoice.payments} currency={invoice.currency}/>

          {/* Timeline */}
          <div className="card">
            <div style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.04em' }}>Timeline</div>
            {[
              { label:'Created',  date: invoice.created_at, done: true },
              { label:'Sent',     date: invoice.sent_at,    done: !!invoice.sent_at },
              { label:'Viewed',   date: invoice.viewed_at,  done: !!invoice.viewed_at },
              { label:'Paid',     date: invoice.paid_at,    done: !!invoice.paid_at },
            ].map(step => (
              <div key={step.label} className={styles.timelineRow}>
                <div className={`${styles.tlDot} ${step.done ? styles.tlDone : ''}`}/>
                <div>
                  <div style={{ fontSize:12, fontWeight: step.done ? 500 : 400, color: step.done ? 'var(--text-primary)':'var(--text-tertiary)' }}>{step.label}</div>
                  {step.date && <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{formatDate(step.date)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPay && (
        <PaymentModal invoice={invoice} onRecord={handleRecord} onClose={() => setShowPay(false)}/>
      )}
    </div>
  )
}

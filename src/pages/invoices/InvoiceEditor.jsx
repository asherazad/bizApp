import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Topbar from '../../components/sidebar/Topbar'
import { useToast } from '../../context/ToastContext'
import { mockFullInvoices, mockClients } from '../../lib/mockInvoiceData'
import { mockDepartments } from '../../lib/mockData'
import { calcInvoice, emptyItem, CURRENCIES, getCurrencySymbol } from '../../lib/invoiceCalc'
import styles from './InvoiceEditor.module.css'

// ─── Line item row ────────────────────────────────────────
function LineItem({ item, index, onChange, onRemove, currency }) {
  const sym = getCurrencySymbol(currency)

  function set(field, value) {
    onChange(index, { ...item, [field]: value })
  }

  return (
    <tr className={styles.lineRow}>
      <td className={styles.tdDesc}>
        <input className={`input input-sm ${styles.descInput}`} placeholder="Description"
          value={item.description} onChange={e => set('description', e.target.value)} />
      </td>
      <td className={styles.tdNum}>
        <input className={`input input-sm ${styles.numInput}`} type="number" min="0" step="any" placeholder="1"
          value={item.quantity} onChange={e => set('quantity', e.target.value)} />
      </td>
      <td className={styles.tdNum}>
        <input className={`input input-sm ${styles.numInput}`} type="number" min="0" step="any" placeholder="0.00"
          value={item.unit_price} onChange={e => set('unit_price', e.target.value)} />
      </td>
      <td className={styles.tdNum}>
        <input className={`input input-sm ${styles.numInput}`} type="number" min="0" max="100" step="any" placeholder="0"
          value={item.discount_pct} onChange={e => set('discount_pct', e.target.value)} />
      </td>
      <td className={styles.tdNum}>
        <input className={`input input-sm ${styles.numInput}`} type="number" min="0" max="100" step="any" placeholder="0"
          value={item.tax_pct} onChange={e => set('tax_pct', e.target.value)} />
      </td>
      <td className={styles.tdTotal}>
        {sym}{item.net_total?.toLocaleString('en-US', { minimumFractionDigits:2 }) ?? '0.00'}
      </td>
      <td>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onRemove(index)} tabIndex={-1}
          style={{ color:'var(--text-tertiary)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    </tr>
  )
}

// ─── Totals panel ─────────────────────────────────────────
function TotalsPanel({ calc, currency, discountType, discountValue, onDiscountTypeChange, onDiscountValueChange }) {
  const sym = getCurrencySymbol(currency)
  const fmt = n => sym + Number(n).toLocaleString('en-US', { minimumFractionDigits:2 })

  return (
    <div className={styles.totalsPanel}>
      <div className={styles.totalRow}>
        <span>Subtotal</span>
        <span>{fmt(calc.subtotal)}</span>
      </div>
      <div className={styles.totalRow}>
        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
          Discount
          <select className="input input-sm" style={{ width:80 }} value={discountType} onChange={e => onDiscountTypeChange(e.target.value)}>
            <option value="percent">%</option>
            <option value="fixed">Fixed</option>
          </select>
          <input className="input input-sm" style={{ width:72 }} type="number" min="0" step="any"
            value={discountValue} onChange={e => onDiscountValueChange(e.target.value)} />
        </span>
        <span style={{ color:'var(--text-secondary)' }}>−{fmt(calc.discount_amount)}</span>
      </div>
      <div className={styles.totalRow}>
        <span>Tax</span>
        <span style={{ color:'var(--text-secondary)' }}>{fmt(calc.tax_amount)}</span>
      </div>
      <div className={`${styles.totalRow} ${styles.grandTotal}`}>
        <span>Total</span>
        <span>{fmt(calc.total)}</span>
      </div>
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────
export default function InvoiceEditor({ mode = 'create' }) {
  const { id }   = useParams()
  const navigate = useNavigate()
  const toast    = useToast()

  // Load existing invoice on edit
  const existing = id ? mockFullInvoices.find(i => i.id === id) : null

  const [docType,  setDocType]  = useState(existing?.type ?? 'invoice')
  const [status,   setStatus]   = useState(existing?.status ?? 'draft')
  const [clientId, setClientId] = useState(existing?.client_id ?? '')
  const [deptId,   setDeptId]   = useState(existing?.dept_id ?? '')
  const [issueDate,setIssueDate]= useState(existing?.issue_date ?? new Date().toISOString().slice(0,10))
  const [dueDate,  setDueDate]  = useState(existing?.due_date ?? '')
  const [currency, setCurrency] = useState(existing?.currency ?? 'USD')
  const [notes,    setNotes]    = useState(existing?.notes ?? '')
  const [terms,    setTerms]    = useState(existing?.terms ?? '')
  const [reference,setRef]      = useState(existing?.reference ?? '')

  const [items, setItems] = useState(
    existing?.items?.length
      ? existing.items.map(i => ({ ...i, _id: crypto.randomUUID() }))
      : [emptyItem()]
  )

  const [discountType,  setDiscountType]  = useState(existing?.discount_type  ?? 'percent')
  const [discountValue, setDiscountValue] = useState(existing?.discount_value ?? 0)
  const [saving, setSaving] = useState(false)

  // Real-time calculation
  const calc = calcInvoice(items, { type: discountType, value: discountValue })

  function updateItem(index, updated) {
    setItems(prev => prev.map((it, i) => i === index ? updated : it))
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()])
  }

  function removeItem(index) {
    if (items.length === 1) { setItems([emptyItem()]); return }
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave(savingStatus = 'draft') {
    if (!clientId) { toast.error('Please select a client'); return }
    if (!deptId)   { toast.error('Please select a department'); return }
    if (items.every(i => !i.description)) { toast.error('Add at least one line item'); return }

    setSaving(true)
    await new Promise(r => setTimeout(r, 500)) // simulate API
    toast.success(mode === 'create' ? `${docType === 'invoice' ? 'Invoice' : 'Quotation'} created` : 'Saved')
    setSaving(false)
    navigate('/invoices')
  }

  const selectedClient = mockClients.find(c => c.id === clientId)

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar
        title={mode === 'create' ? `New ${docType}` : `Edit ${existing?.number ?? ''}`}
        actions={
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleSave('draft')} disabled={saving}>
              Save draft
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => handleSave('sent')} disabled={saving}>
              {saving ? 'Saving…' : docType === 'invoice' ? 'Save & send' : 'Save & send quote'}
            </button>
          </div>
        }
      />

      <div className={styles.editorLayout}>
        {/* ── Left column — form ─────────────────────────────── */}
        <div className={styles.formCol}>

          {/* Doc type selector (only on create) */}
          {mode === 'create' && (
            <div className={styles.typeToggle}>
              {['invoice','quotation'].map(t => (
                <button key={t} className={`${styles.typeBtn} ${docType === t ? styles.typeActive : ''}`}
                  onClick={() => setDocType(t)}>
                  {t === 'invoice' ? '🧾 Invoice' : '📋 Quotation'}
                </button>
              ))}
            </div>
          )}

          {/* Header fields */}
          <div className="card">
            <div className={styles.headerGrid}>
              <div className="field">
                <label className="label">Client *</label>
                <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">— Select client —</option>
                  {mockClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedClient && (
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:3 }}>
                    {selectedClient.email} · {selectedClient.address}
                  </div>
                )}
              </div>

              <div className="field">
                <label className="label">Department *</label>
                <select className="input" value={deptId} onChange={e => setDeptId(e.target.value)}>
                  <option value="">— Select department —</option>
                  {mockDepartments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </div>

              <div className="field">
                <label className="label">Issue date</label>
                <input className="input" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}/>
              </div>

              <div className="field">
                <label className="label">Due date</label>
                <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/>
              </div>

              <div className="field">
                <label className="label">Currency</label>
                <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="label">Reference / PO number</label>
                <input className="input" placeholder="e.g. PO-2025-001" value={reference} onChange={e => setRef(e.target.value)}/>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', fontSize:12, fontWeight:500, color:'var(--text-secondary)' }}>
              Line items
            </div>
            <div className="table-wrap">
              <table className={`data-table ${styles.lineTable}`}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign:'center' }}>Qty</th>
                    <th style={{ textAlign:'center' }}>Unit price</th>
                    <th style={{ textAlign:'center' }}>Disc %</th>
                    <th style={{ textAlign:'center' }}>Tax %</th>
                    <th style={{ textAlign:'right' }}>Total</th>
                    <th style={{ width:32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <LineItem
                      key={item._id}
                      item={calc.items[i] ?? item}
                      index={i}
                      onChange={updateItem}
                      onRemove={removeItem}
                      currency={currency}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'10px 16px', borderTop:'0.5px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" onClick={addItem}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add line item
              </button>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="card">
            <div className={styles.notesGrid}>
              <div className="field">
                <label className="label">Notes <span style={{ color:'var(--text-tertiary)' }}>(visible to client)</span></label>
                <textarea className="input" rows={3} placeholder="Thank you for your business." value={notes} onChange={e => setNotes(e.target.value)}/>
              </div>
              <div className="field">
                <label className="label">Terms & conditions</label>
                <textarea className="input" rows={3} placeholder="Payment due within 15 days…" value={terms} onChange={e => setTerms(e.target.value)}/>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column — totals + preview ───────────────── */}
        <div className={styles.sideCol}>
          <TotalsPanel
            calc={calc}
            currency={currency}
            discountType={discountType}
            discountValue={discountValue}
            onDiscountTypeChange={setDiscountType}
            onDiscountValueChange={setDiscountValue}
          />

          {/* Quick client card */}
          {selectedClient && (
            <div className="card">
              <div style={{ fontSize:11, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:10 }}>Bill to</div>
              <div style={{ fontWeight:500, fontSize:13 }}>{selectedClient.name}</div>
              {selectedClient.email    && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{selectedClient.email}</div>}
              {selectedClient.phone    && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{selectedClient.phone}</div>}
              {selectedClient.address  && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{selectedClient.address}</div>}
              {selectedClient.tax_number && <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>Tax no: {selectedClient.tax_number}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

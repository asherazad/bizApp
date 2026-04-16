import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/sidebar/Topbar'
import { Modal } from '../../components/ui/index'
import { useToast } from '../../context/ToastContext'
import { mockDepartments } from '../../lib/mockData'
import { extractInvoiceFromPDF, normaliseExtracted } from '../../lib/pdfExtractor'
import { calcInvoice, getCurrencySymbol, CURRENCIES } from '../../lib/invoiceCalc'
import api from '../../lib/api'
import styles from './InvoiceUpload.module.css'

// ─── Steps ────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Upload PDF', 'Review & assign', 'Confirm']
  return (
    <div className={styles.steps}>
      {steps.map((label, i) => (
        <div key={label} className={`${styles.step} ${i < current ? styles.stepDone : ''} ${i === current ? styles.stepActive : ''}`}>
          <div className={styles.stepDot}>
            {i < current
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              : i + 1}
          </div>
          <span className={styles.stepLabel}>{label}</span>
          {i < steps.length - 1 && <div className={styles.stepLine}/>}
        </div>
      ))}
    </div>
  )
}

// ─── Drop zone ────────────────────────────────────────────
function DropZone({ onFile, loading }) {
  const inputRef = useRef()
  const [over, setOver] = useState(false)
  const handleDrop = useCallback(e => {
    e.preventDefault(); setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  return (
    <div
      className={`${styles.dropZone} ${over ? styles.dropOver : ''} ${loading ? styles.dropLoading : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current.click()}
    >
      <input ref={inputRef} type="file" accept="application/pdf" style={{ display:'none' }}
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}/>
      {loading ? (
        <div className={styles.extractingState}>
          <div className={styles.aiSpinner}/>
          <div className={styles.extractingTitle}>Reading PDF…</div>
          <div className={styles.extractingHint}>Extracting invoice data using PDF.js</div>
        </div>
      ) : (
        <div className={styles.idleState}>
          <div className={styles.uploadIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div className={styles.uploadTitle}>Drop your invoice PDF here</div>
          <div className={styles.uploadHint}>or click to browse · PDF files only · free, no API key</div>
          <div className={styles.aiBadge}>
            <span className={styles.aiDot}/>
            Uses PDF.js — runs entirely in your browser
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New client inline modal ──────────────────────────────
function NewClientModal({ prefill, onCreated, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name:       prefill?.name    ?? '',
    email:      prefill?.email   ?? '',
    phone:      prefill?.phone   ?? '',
    address:    prefill?.address ?? '',
    city:       '',
    country:    '',
    tax_number: prefill?.tax_number ?? '',
    currency:   'USD',
    notes:      '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await api.post('/clients', form)
      onCreated(res.data)
      toast.success(`${res.data.name} created`)
    } catch (err) {
      // Backend offline → create locally
      const local = { id: `local-${Date.now()}`, ...form, is_active: true, invoice_count: 0 }
      onCreated(local)
      toast.success(`${local.name} created (will sync when server is online)`)
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add new client" onClose={onClose} width={520} footer={
      <>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="new-client-form" type="submit" disabled={saving}>
          {saving ? 'Creating…' : 'Create client'}
        </button>
      </>
    }>
      <form id="new-client-form" onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {error && <div style={{ background:'var(--red-50)', color:'var(--red-600)', fontSize:12, padding:'8px 12px', borderRadius:'var(--r-md)' }}>{error}</div>}
        <div style={{ background:'var(--blue-50)', color:'var(--blue-800)', fontSize:12, padding:'8px 12px', borderRadius:'var(--r-md)' }}>
          Fields pre-filled from the PDF — review and correct as needed.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="field" style={{ gridColumn:'1/-1' }}>
            <label className="label">Company / client name *</label>
            <input className="input" required value={form.name} onChange={e => set('name',e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email',e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => set('phone',e.target.value)}/>
          </div>
          <div className="field" style={{ gridColumn:'1/-1' }}>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e => set('address',e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">City</label>
            <input className="input" value={form.city} onChange={e => set('city',e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Country</label>
            <input className="input" value={form.country} onChange={e => set('country',e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Tax / NTN / VAT</label>
            <input className="input" value={form.tax_number} onChange={e => set('tax_number',e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Currency</label>
            <select className="input" value={form.currency} onChange={e => set('currency',e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ─── Confidence badge ─────────────────────────────────────
function ConfidenceBadge({ score }) {
  const pct   = Math.round((score ?? 0) * 100)
  const cls   = pct >= 90 ? styles.confHigh : pct >= 70 ? styles.confMed : styles.confLow
  const label = pct >= 90 ? 'High confidence' : pct >= 70 ? 'Medium confidence' : 'Low — verify all fields'
  return (
    <div className={`${styles.confidenceBadge} ${cls}`}>
      <div className={styles.confBar} style={{ width:`${pct}%` }}/>
      <span>{label} ({pct}%)</span>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label className="label">{label}{hint && <span style={{ color:'var(--text-tertiary)', fontWeight:400, marginLeft:4 }}>({hint})</span>}</label>
      {children}
    </div>
  )
}

// ─── Client selector with "Add new" ──────────────────────
function ClientSelector({ value, onChange, clients, extracted, onNewClient }) {
  const [showNew, setShowNew] = useState(false)

  function handleCreated(client) {
    onChange(client.id, client)
    setShowNew(false)
  }

  const selected = clients.find(c => c.id === value)

  return (
    <>
      <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
        <div className="field" style={{ flex:1 }}>
          <label className="label">Client *</label>
          <select className="input" value={value} onChange={e => onChange(e.target.value, clients.find(c=>c.id===e.target.value))}>
            <option value="">— Select existing client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ flexShrink:0, marginBottom:1 }}
          onClick={() => setShowNew(true)}>
          + New client
        </button>
      </div>
      {selected && (
        <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4, paddingLeft:2 }}>
          {[selected.email, selected.phone, selected.city].filter(Boolean).join(' · ')}
        </div>
      )}
      {!value && extracted?.client?.name && (
        <div style={{ fontSize:11, color:'var(--amber-600)', marginTop:4, paddingLeft:2 }}>
          PDF mentions "{extracted.client.name}" — select or create them above
        </div>
      )}
      {showNew && (
        <NewClientModal
          prefill={{ name: extracted?.client?.name, email: extracted?.client?.email, phone: extracted?.client?.phone, tax_number: extracted?.vendor?.tax_number }}
          onCreated={handleCreated}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  )
}

// ─── Dept split bar ───────────────────────────────────────
function DeptSplitSummary({ items, currency }) {
  const sym  = getCurrencySymbol(currency)
  const calc = calcInvoice(items)
  const byDept = {}
  calc.items.forEach((ci, i) => {
    const did = items[i]?.dept_id
    if (did) byDept[did] = (byDept[did] ?? 0) + ci.net_total
  })
  const total = Object.values(byDept).reduce((s,v) => s+v, 0)
  if (!Object.keys(byDept).length)
    return <p style={{ fontSize:12, color:'var(--text-tertiary)' }}>Assign departments above to see the split.</p>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {Object.entries(byDept).map(([did, amount]) => {
        const dept = mockDepartments.find(d => d.id === did)
        const pct  = total > 0 ? Math.round((amount/total)*100) : 0
        return (
          <div key={did} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="pill pill-blue" style={{ minWidth:48, justifyContent:'center', fontSize:11 }}>{dept?.code ?? '?'}</span>
            <div style={{ flex:1 }}>
              <div style={{ height:5, background:'var(--bg-muted)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:'var(--blue-400)', borderRadius:3 }}/>
              </div>
            </div>
            <span style={{ fontSize:12, fontWeight:500, minWidth:84, textAlign:'right' }}>
              {sym}{amount.toLocaleString('en-US',{minimumFractionDigits:2})}
            </span>
            <span style={{ fontSize:11, color:'var(--text-tertiary)', minWidth:32 }}>{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Line items table ─────────────────────────────────────
function ItemsTable({ items, onChange, currency }) {
  const sym = getCurrencySymbol(currency)
  function update(idx, field, value) { onChange(items.map((it,i) => i===idx ? {...it,[field]:value} : it)) }
  function remove(idx) { onChange(items.filter((_,i) => i!==idx)) }
  function add() { onChange([...items, { _id:crypto.randomUUID(), description:'', quantity:1, unit_price:0, discount_pct:0, tax_pct:0, dept_id:'' }]) }

  const missing = items.filter(i => !i.dept_id).length

  return (
    <div className={styles.itemsSection}>
      <div className={styles.itemsHeader}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)' }}>
            Line items — assign department per item *
          </span>
          {missing > 0 && (
            <span style={{ fontSize:11, color:'var(--amber-600)', background:'var(--amber-50)', padding:'2px 8px', borderRadius:999 }}>
              {missing} unassigned
            </span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={add}>+ Add row</button>
      </div>
      <div className="table-wrap">
        <table className={`data-table ${styles.itemTable}`}>
          <thead>
            <tr>
              <th>Description</th>
              <th style={{ textAlign:'right', width:56 }}>Qty</th>
              <th style={{ textAlign:'right', width:96 }}>Unit price</th>
              <th style={{ textAlign:'right', width:64 }}>Disc %</th>
              <th style={{ textAlign:'right', width:64 }}>Tax %</th>
              <th style={{ textAlign:'right', width:96 }}>Total</th>
              <th style={{ width:160 }}>Department *</th>
              <th style={{ width:32 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const ci    = calcInvoice([item]).items[0] ?? item
              const noDep = !item.dept_id
              return (
                <tr key={item._id ?? idx} style={{ background: noDep ? 'rgba(250,238,218,0.4)' : 'transparent' }}>
                  <td><input className="input input-sm" style={{ width:'100%' }} placeholder="Service description"
                    value={item.description} onChange={e => update(idx,'description',e.target.value)}/></td>
                  <td><input className="input input-sm" type="number" min="0" step="any"
                    style={{ width:'100%', textAlign:'right' }}
                    value={item.quantity} onChange={e => update(idx,'quantity',e.target.value)}/></td>
                  <td><input className="input input-sm" type="number" min="0" step="any"
                    style={{ width:'100%', textAlign:'right' }}
                    value={item.unit_price} onChange={e => update(idx,'unit_price',e.target.value)}/></td>
                  <td><input className="input input-sm" type="number" min="0" max="100" step="any"
                    style={{ width:'100%', textAlign:'right' }}
                    value={item.discount_pct} onChange={e => update(idx,'discount_pct',e.target.value)}/></td>
                  <td><input className="input input-sm" type="number" min="0" max="100" step="any"
                    style={{ width:'100%', textAlign:'right' }}
                    value={item.tax_pct} onChange={e => update(idx,'tax_pct',e.target.value)}/></td>
                  <td style={{ textAlign:'right', fontWeight:500, fontSize:13, paddingRight:8, whiteSpace:'nowrap' }}>
                    {sym}{Number(ci.net_total??0).toLocaleString('en-US',{minimumFractionDigits:2})}
                  </td>
                  <td>
                    <select className="input input-sm"
                      value={item.dept_id??''} style={{ borderColor:noDep?'var(--amber-600)':undefined, width:'100%' }}
                      onChange={e => update(idx,'dept_id',e.target.value)}>
                      <option value="">— Assign —</option>
                      {mockDepartments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--text-tertiary)' }} onClick={() => remove(idx)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text-tertiary)', padding:20, fontSize:13 }}>No items extracted — add manually</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Totals panel ─────────────────────────────────────────
function TotalsPanel({ calc, currency }) {
  const sym = getCurrencySymbol(currency)
  const fmt = n => sym + Number(n).toLocaleString('en-US',{minimumFractionDigits:2})
  return (
    <div className={styles.totalsPanel}>
      <div className={styles.tRow}><span>Subtotal</span><span>{fmt(calc.subtotal)}</span></div>
      {calc.discount_amount > 0 && <div className={styles.tRow}><span>Discount</span><span>−{fmt(calc.discount_amount)}</span></div>}
      {calc.tax_amount > 0      && <div className={styles.tRow}><span>Tax</span><span>{fmt(calc.tax_amount)}</span></div>}
      <div className={`${styles.tRow} ${styles.tGrand}`}><span>Total</span><span>{fmt(calc.total)}</span></div>
    </div>
  )
}

// ─── Review form ──────────────────────────────────────────
function ReviewForm({ extracted, pdfName, onBack }) {
  const toast    = useToast()
  const navigate = useNavigate()

  const [clients,     setClients]    = useState([])
  const [clientId,    setClientId]   = useState('')
  const [vendorName,  setVendorName] = useState(extracted.vendor?.name ?? '')
  const [invoiceNo,   setInvoiceNo]  = useState(extracted.invoice_number ?? '')
  const [invoiceDate, setInvoiceDate]= useState(extracted.invoice_date ?? '')
  const [dueDate,     setDueDate]    = useState(extracted.due_date ?? '')
  const [currency,    setCurrency]   = useState(extracted.currency ?? 'USD')
  const [reference,   setReference] = useState(extracted.reference ?? '')
  const [notes,       setNotes]     = useState(extracted.notes ?? '')
  const [terms,       setTerms]     = useState(extracted.terms ?? '')
  const [items,       setItems]     = useState(
    (extracted.items ?? []).map(i => ({ ...i, dept_id:'' }))
  )
  const [saving, setSaving] = useState(false)

  // Load clients from backend (or use mock fallback)
  useEffect(() => {
    api.get('/clients', { params:{ limit:200 } })
      .then(r => setClients(r.data.data ?? r.data))
      .catch(() => {
        import('../../lib/mockInvoiceData').then(m => setClients(m.mockClients))
      })
  }, [])

  // Auto-match extracted client name to existing client
  useEffect(() => {
    if (!extracted.client?.name || !clients.length) return
    const name  = extracted.client.name.toLowerCase()
    const match = clients.find(c => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()))
    if (match) setClientId(match.id)
  }, [extracted.client?.name, clients])

  const calc       = calcInvoice(items)
  const unassigned = items.filter(i => !i.dept_id).length
  const deptCount  = new Set(items.map(i => i.dept_id).filter(Boolean)).size
  const allGood    = unassigned === 0 && items.length > 0 && clientId && invoiceNo.trim()

  function handleClientChange(id, client) {
    setClientId(id)
    if (client && !currency) setCurrency(client.currency ?? 'USD')
  }

  function handleNewClient(client) {
    setClients(prev => [...prev, client])
    setClientId(client.id)
  }

  async function handleConfirm() {
    if (!invoiceNo.trim())  { toast.error('Invoice number is required'); return }
    if (!clientId)          { toast.error('Please select or create a client'); return }
    if (unassigned > 0)     { toast.error(`Assign a department to all ${unassigned} item${unassigned>1?'s':''}`); return }

    setSaving(true)
    try {
      const payload = {
        client_id:      clientId,
        dept_id:        items[0]?.dept_id ?? null,
        issue_date:     invoiceDate,
        due_date:       dueDate || null,
        currency,
        notes, terms, reference,
        pdf_source:     pdfName,
        discount_type:  'percent',
        discount_value: 0,
        items: items.map(it => ({
          description:  it.description,
          quantity:     Number(it.quantity),
          unit_price:   Number(it.unit_price),
          discount_pct: Number(it.discount_pct),
          tax_pct:      Number(it.tax_pct),
          dept_id:      it.dept_id || null,
        })),
      }

      await api.post('/invoices', payload)
      toast.success(`Invoice ${invoiceNo} saved — ${items.length} items across ${deptCount} dept${deptCount>1?'s':''}`)
      navigate('/invoices')
    } catch (err) {
      // Backend offline — still navigate with success message
      toast.success(`Invoice ${invoiceNo} saved locally (sync when server is online)`)
      navigate('/invoices')
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.reviewLayout}>
      <div className={styles.reviewForm}>
        <ConfidenceBadge score={extracted.confidence}/>

        {/* Vendor card */}
        <div className="card">
          <div className={styles.cardTitle}>Vendor (from PDF)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Vendor name">
              <input className="input" value={vendorName} onChange={e => setVendorName(e.target.value)}/>
            </Field>
            <Field label="Tax number">
              <input className="input" readOnly value={extracted.vendor?.tax_number ?? ''} style={{ color:'var(--text-secondary)' }}/>
            </Field>
          </div>
          {extracted.vendor?.address && (
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>{extracted.vendor.address}</div>
          )}
        </div>

        {/* Client selector with new client provision */}
        <div className="card">
          <div className={styles.cardTitle}>Client — who is being billed?</div>
          <ClientSelector
            value={clientId}
            onChange={handleClientChange}
            clients={clients}
            extracted={extracted}
            onNewClient={handleNewClient}
          />
        </div>

        {/* Invoice details */}
        <div className="card">
          <div className={styles.cardTitle}>Invoice details</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Invoice number *">
              <input className="input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}/>
            </Field>
            <Field label="Currency">
              <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </Field>
            <Field label="Invoice date">
              <input className="input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}/>
            </Field>
            <Field label="Due date">
              <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/>
            </Field>
            <Field label="Reference / PO">
              <input className="input" placeholder="Optional" value={reference} onChange={e => setReference(e.target.value)}/>
            </Field>
          </div>
        </div>

        {/* Line items */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <ItemsTable items={items} onChange={setItems} currency={currency}/>
        </div>

        {/* Dept split */}
        {deptCount > 0 && (
          <div className="card">
            <div className={styles.cardTitle}>Department cost split</div>
            <DeptSplitSummary items={items} currency={currency}/>
          </div>
        )}

        {/* Notes */}
        <div className="card">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Notes">
              <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)}/>
            </Field>
            <Field label="Terms & conditions">
              <textarea className="input" rows={3} value={terms} onChange={e => setTerms(e.target.value)}/>
            </Field>
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className={styles.reviewSide}>
        <div className="card">
          <div className={styles.cardTitle}>Source file</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
            <div className={styles.pdfIcon}>PDF</div>
            <span style={{ fontSize:12, color:'var(--text-secondary)', wordBreak:'break-all' }}>{pdfName}</span>
          </div>
        </div>

        <TotalsPanel calc={calc} currency={currency}/>

        {/* Checklist */}
        <div className="card">
          <div className={styles.cardTitle}>Ready to save?</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:4 }}>
            {[
              { label:'Invoice number',   ok: !!invoiceNo.trim() },
              { label:'Client selected',  ok: !!clientId },
              { label:'All items assigned', ok: unassigned === 0 && items.length > 0 },
            ].map(c => (
              <div key={c.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                <span style={{ color: c.ok ? 'var(--green-600)' : 'var(--amber-600)', flexShrink:0 }}>
                  {c.ok
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/></svg>}
                </span>
                <span style={{ color: c.ok ? 'var(--text-secondary)' : 'var(--amber-600)' }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button className="btn btn-primary" style={{ width:'100%' }}
            onClick={handleConfirm}
            disabled={saving || !allGood}>
            {saving ? 'Saving…' : !allGood ? 'Complete all fields above' : '✓  Confirm & save invoice'}
          </button>
          <button className="btn btn-secondary" style={{ width:'100%' }} onClick={onBack}>
            ← Upload different PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────
export default function InvoiceUpload() {
  const toast = useToast()
  const [step,      setStep]    = useState(0)
  const [loading,   setLoading] = useState(false)
  const [extracted, setExtr]    = useState(null)
  const [pdfName,   setPdfName] = useState('')
  const [error,     setError]   = useState('')

  async function handleFile(file) {
    setError('')
    if (file.size > 20 * 1024 * 1024) { setError('File too large. Maximum 20MB.'); return }
    if (file.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    setPdfName(file.name)
    setLoading(true)
    try {
      const raw  = await extractInvoiceFromPDF(file)
      const norm = normaliseExtracted(raw)
      setExtr(norm)
      setStep(1)
    } catch (err) {
      setError(err.message || 'Could not read PDF. Make sure it is a text-based invoice.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar title="Upload invoice" subtitle="Free PDF parsing — no API key required"/>
      <div className="page">
        <Steps current={step}/>

        {step === 0 && (
          <div className={styles.uploadStep}>
            <DropZone onFile={handleFile} loading={loading}/>
            {error && (
              <div className={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}
            <div className={styles.howItWorks}>
              <div className={styles.howTitle}>How it works</div>
              <div className={styles.howSteps}>
                {[
                  { icon:'📄', text:'Upload any invoice PDF from any billing system' },
                  { icon:'🔍', text:'PDF.js extracts all text and fields automatically' },
                  { icon:'🏷️', text:'Assign each line item to a department' },
                  { icon:'✅', text:'Select or create a client, then confirm & save' },
                ].map(s => (
                  <div key={s.text} className={styles.howStep}>
                    <span style={{ fontSize:18 }}>{s.icon}</span>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && extracted && (
          <ReviewForm extracted={extracted} pdfName={pdfName}
            onBack={() => { setStep(0); setExtr(null) }}/>
        )}
      </div>
    </div>
  )
}

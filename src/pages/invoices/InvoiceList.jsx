import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/sidebar/Topbar'
import { SearchInput, StatusPill, ConfirmModal } from '../../components/ui/index'
import { useToast } from '../../context/ToastContext'
import { useInvoices } from '../../lib/apiHooks'
import { mockFullInvoices } from '../../lib/mockInvoiceData'  // fallback when server is offline
import { mockDepartments } from '../../lib/mockData'
import { formatDate, formatShort } from '../../lib/format'
import { STATUS_META, getCurrencySymbol } from '../../lib/invoiceCalc'
import styles from './InvoiceList.module.css'
import api from '../../lib/api'

const STATUSES = ['draft','sent','viewed','partial','paid','overdue','cancelled']

// ─── Summary bar ──────────────────────────────────────────
function SummaryBar({ invoices }) {
  const total       = invoices.reduce((s, i) => s + Number(i.total),      0)
  const paid        = invoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  const outstanding = total - paid
  const overdue     = invoices.filter(i => i.status === 'overdue')
                               .reduce((s,i) => s + Number(i.amount_due ?? (Number(i.total)-Number(i.amount_paid))), 0)
  const items = [
    { label:'Total invoiced', val: formatShort(total),       color: null },
    { label:'Collected',      val: formatShort(paid),        color:'var(--green-600)' },
    { label:'Outstanding',    val: formatShort(outstanding), color: null },
    { label:'Overdue',        val: formatShort(overdue),     color: overdue > 0 ? 'var(--red-600)' : 'var(--text-tertiary)' },
  ]
  return (
    <div className={styles.summaryBar}>
      {items.map((item, i) => (
        <div key={item.label} style={{ display:'flex' }}>
          {i > 0 && <div className={styles.sumDivider}/>}
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>{item.label}</span>
            <span className={styles.sumVal} style={item.color ? { color: item.color } : {}}>
              {item.val}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Status filter tabs ───────────────────────────────────
function StatusTabs({ value, onChange, counts }) {
  return (
    <div className={styles.statusTabs}>
      <button className={`${styles.statusTab} ${!value ? styles.tabActive : ''}`} onClick={() => onChange('')}>
        All <span className={styles.tabCount}>{counts.total ?? 0}</span>
      </button>
      {['draft','sent','viewed','partial','paid','overdue'].map(s => (
        <button key={s}
          className={`${styles.statusTab} ${value === s ? styles.tabActive : ''}`}
          onClick={() => onChange(s)}>
          {STATUS_META[s]?.label ?? s}
          {counts[s] > 0 && <span className={styles.tabCount}>{counts[s]}</span>}
        </button>
      ))}
    </div>
  )
}

export default function InvoiceList() {
  const navigate = useNavigate()
  const toast    = useToast()

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter,   setDeptFilter]   = useState('')
  const [deleting,     setDeleting]     = useState(null)
  const [serverUp,     setServerUp]     = useState(null)

  // Try backend, fall back to mock
  const { invoices: liveInvoices, loading, error, refetch, deleteInvoice, sendInvoice } =
    useInvoices({ status: statusFilter || undefined, dept_id: deptFilter || undefined, search: search || undefined })

  useEffect(() => {
    api.get('/health').then(() => setServerUp(true)).catch(() => setServerUp(false))
  }, [])

  const invoices = serverUp === false ? mockFullInvoices : liveInvoices

  // Status counts
  const counts = useMemo(() => {
    const c = { total: invoices.length }
    invoices.forEach(i => { c[i.status] = (c[i.status] ?? 0) + 1 })
    return c
  }, [invoices])

  // Client-side filter when using mock data
  const filtered = useMemo(() => {
    if (serverUp !== false) return invoices
    return invoices.filter(inv => {
      if (statusFilter && inv.status !== statusFilter)    return false
      if (deptFilter   && inv.dept_id !== deptFilter)     return false
      if (search) {
        const q = search.toLowerCase()
        if (!inv.client_name.toLowerCase().includes(q) && !inv.number.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [invoices, statusFilter, deptFilter, search, serverUp])

  async function handleDelete(invoice) {
    try {
      if (serverUp) {
        await deleteInvoice(invoice.id)
      }
      toast.success(`Invoice ${invoice.number} cancelled`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? err.message)
    }
    setDeleting(null)
  }

  async function handleSend(invoice, e) {
    e.stopPropagation()
    try {
      await sendInvoice(invoice.id)
      toast.success(`Invoice ${invoice.number} marked as sent`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar
        title="Invoices"
        subtitle={`${filtered.length} invoice${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/invoices/upload')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload invoice PDF
          </button>
        }
      />

      <div className="page">
        {serverUp === false && (
          <div style={{ background:'var(--amber-50)', border:'0.5px solid var(--amber-600)', borderRadius:'var(--r-md)', padding:'8px 14px', fontSize:12, color:'var(--amber-600)' }}>
            Backend server is offline — showing demo data. Run <code style={{ fontFamily:'var(--font-mono)' }}>npm run dev:full</code> to connect.
          </div>
        )}

        <SummaryBar invoices={filtered}/>
        <StatusTabs value={statusFilter} onChange={setStatusFilter} counts={counts}/>

        <div className={styles.filterRow}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by client or invoice number…" style={{ width:300 }}/>
          <select className="input input-sm" style={{ width:160 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All departments</option>
            {mockDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="table-wrap">
            {loading && serverUp !== false ? (
              <div style={{ padding:48, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }}/></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--text-tertiary)', fontSize:13 }}>
                No invoices found
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Client</th>
                    <th>Dept</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th style={{ textAlign:'right' }}>Amount</th>
                    <th style={{ textAlign:'right' }}>Balance due</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const due    = Number(inv.amount_due ?? (Number(inv.total) - Number(inv.amount_paid)))
                    const sym    = getCurrencySymbol(inv.currency)
                    const dept   = mockDepartments.find(d => d.id === inv.dept_id)
                    return (
                      <tr key={inv.id} className={styles.tableRow} onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <td>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--blue-600)', fontWeight:500 }}>
                            {inv.number}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight:500 }}>{inv.client_name}</div>
                          {inv.client_email && (
                            <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{inv.client_email}</div>
                          )}
                        </td>
                        <td>
                          {(dept ?? inv.dept_code)
                            ? <span className="pill pill-gray">{dept?.code ?? inv.dept_code}</span>
                            : '—'}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{formatDate(inv.issue_date)}</td>
                        <td style={{ fontSize:12, color: inv.status==='overdue' ? 'var(--red-600)' : 'var(--text-secondary)' }}>
                          {formatDate(inv.due_date)}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:500 }}>
                          {sym}{Number(inv.total).toLocaleString('en-US',{minimumFractionDigits:2})}
                        </td>
                        <td style={{ textAlign:'right', color: due > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {due > 0 ? `${sym}${due.toLocaleString('en-US',{minimumFractionDigits:2})}` : '—'}
                        </td>
                        <td><StatusPill status={inv.status}/></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display:'flex', gap:2, justifyContent:'flex-end' }}>
                            {inv.status === 'draft' && (
                              <button className="btn btn-ghost btn-sm" onClick={e => handleSend(inv, e)}>
                                Send
                              </button>
                            )}
                            {!['paid','cancelled'].includes(inv.status) && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color:'var(--red-600)' }}
                                onClick={e => { e.stopPropagation(); setDeleting(inv) }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className={styles.tableFooter}>
            <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>
              {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {deleting && (
        <ConfirmModal
          title="Cancel invoice"
          message={`Cancel invoice ${deleting.number} for ${deleting.client_name}? This cannot be undone. Paid invoices cannot be cancelled.`}
          confirmLabel="Cancel invoice"
          danger
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

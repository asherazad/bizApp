import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/sidebar/Topbar'
import { SearchInput, StatusPill, ConfirmModal } from '../../components/ui/index'
import { useToast } from '../../context/ToastContext'
import { mockQuotations } from '../../lib/mockInvoiceData'
import { mockDepartments } from '../../lib/mockData'
import { formatDate } from '../../lib/format'
import { getCurrencySymbol, STATUS_META } from '../../lib/invoiceCalc'
import styles from '../invoices/InvoiceList.module.css'

export default function QuotationList() {
  const navigate  = useNavigate()
  const toast     = useToast()
  const [search,  setSearch]  = useState('')
  const [quotes,  setQuotes]  = useState(mockQuotations)
  const [converting, setConverting] = useState(null)

  const filtered = useMemo(() =>
    quotes.filter(q =>
      !search ||
      q.client_name.toLowerCase().includes(search.toLowerCase()) ||
      q.number.toLowerCase().includes(search.toLowerCase())
    ), [quotes, search])

  function handleConvert(quote) {
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status:'converted' } : q))
    toast.success(`${quote.number} converted to invoice`)
    setConverting(null)
    navigate('/invoices')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar
        title="Quotations"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/quotations/upload')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload quotation PDF
          </button>
        }
      />

      <div className="page">
        <div className={styles.filterRow}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search quotations…" style={{ width:260 }}/>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Dept</th>
                  <th>Issued</th>
                  <th>Valid until</th>
                  <th style={{ textAlign:'right' }}>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className={styles.tableRow} onClick={() => navigate(`/quotations/${q.id}`)}>
                    <td>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--purple-600)', fontWeight:500 }}>{q.number}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight:500 }}>{q.client_name}</div>
                    </td>
                    <td>
                      {(() => { const d = mockDepartments.find(d=>d.id===q.dept_id); return d ? <span className="pill pill-gray">{d.code}</span> : '—' })()}
                    </td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{formatDate(q.issue_date)}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{formatDate(q.due_date)}</td>
                    <td style={{ textAlign:'right', fontWeight:500 }}>
                      {getCurrencySymbol(q.currency)}{Number(q.total).toLocaleString('en-US',{minimumFractionDigits:2})}
                    </td>
                    <td><StatusPill status={q.status}/></td>
                    <td>
                      <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                        {['accepted','sent','draft'].includes(q.status) && (
                          <button className="btn btn-primary btn-sm" onClick={() => setConverting(q)}>
                            Convert to invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{filtered.length} quotation{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {converting && (
        <ConfirmModal
          title="Convert to invoice"
          message={`Convert ${converting.number} into a new invoice for ${converting.client_name}? The quotation will be marked as converted.`}
          confirmLabel="Convert to invoice"
          onConfirm={() => handleConvert(converting)}
          onClose={() => setConverting(null)}
        />
      )}
    </div>
  )
}

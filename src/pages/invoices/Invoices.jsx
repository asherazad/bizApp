import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, statusBadgeClass } from '../../lib/format';
import { Plus, Upload, Filter } from 'lucide-react';
import InvoiceWizard from './InvoiceWizard';
import InvoiceDetail from './InvoiceDetail';
import InvoiceFileViewer from '../../components/InvoiceFileViewer';

const STATUSES   = ['', 'Pending', 'Received', 'Overdue', 'Disputed'];
const CURRENCIES = ['', 'PKR', 'USD', 'EUR', 'AED', 'GBP'];

// Wing badges for the Wings column
function WingBadges({ inv }) {
  const mode        = inv.wing_assignment_mode || 'single';
  const wing_splits = inv.wing_splits || [];

  if (mode === 'single' || !wing_splits.length) {
    return <span className="badge badge-neutral" style={{ fontSize: 11 }}>{inv.wing_name || '—'}</span>;
  }

  const shown = wing_splits.slice(0, 2);
  const extra = wing_splits.length - 2;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {shown.map(s => (
        <span key={s.business_wing_id} className="badge badge-neutral" style={{ fontSize: 11 }}>{s.wing_name}</span>
      ))}
      {extra > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{extra}</span>}
      {mode === 'line_item' && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>by line</span>}
    </div>
  );
}

export default function Invoices() {
  const { activeWing, wings } = useAuth();
  const toast                 = useToast();

  const [invoices, setInvoices]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); // null | 'import' | 'new' | invoiceId UUID

  // Filters
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [filterPOOnly,   setFilterPOOnly]   = useState(false);
  const [showFilters,    setShowFilters]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (activeWing?.id)   params.wing_id   = activeWing.id;
    if (filterStatus)     params.status    = filterStatus;
    if (filterCurrency)   params.currency  = filterCurrency;
    if (filterDateFrom)   params.date_from = filterDateFrom;
    if (filterDateTo)     params.date_to   = filterDateTo;
    try { setInvoices((await api.get('/invoices', { params })).data); }
    catch { toast('Failed to load invoices', 'error'); }
    finally { setLoading(false); }
  }, [activeWing, filterStatus, filterCurrency, filterDateFrom, filterDateTo]);

  useEffect(() => { load(); }, [load]);

  const displayed = filterPOOnly ? invoices.filter(i => i.po_id) : invoices;

  const totalPending = invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + parseFloat(i.pkr_equivalent||i.total_amount||0), 0);
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length;

  function closeModal() { setModal(null); }
  function afterSave()  { closeModal(); load(); }

  const isUUID = (v) => v && v.length === 36 && v.includes('-');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          {!loading && invoices.length > 0 && (
            <div style={{ fontSize: 13, marginTop: 2, color: 'var(--text-muted)' }}>
              {invoices.length} invoices
              {totalPending > 0 && <> · Pending: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(totalPending, 'PKR')}</strong></>}
              {overdueCount > 0 && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>· {overdueCount} overdue</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setShowFilters(f => !f)}>
            <Filter size={14}/> Filters
          </button>
          <button className="btn btn-secondary" onClick={() => setModal('import')}>
            <Upload size={14}/> Import PDF
          </button>
          <button className="btn btn-primary" onClick={() => setModal('new')}>
            <Plus size={14}/> New Invoice
          </button>
        </div>
      </div>

      {/* Status pill filters */}
      <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(s)}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="card mb-4" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, alignItems: 'end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Currency</label>
              <select className="form-control" value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c || 'All currencies'}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date From</label>
              <input type="date" className="form-control" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}/>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date To</label>
              <input type="date" className="form-control" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
              <input type="checkbox" id="po-only" checked={filterPOOnly} onChange={e => setFilterPOOnly(e.target.checked)}/>
              <label htmlFor="po-only" style={{ fontSize: 13, cursor: 'pointer' }}>PO linked only</label>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilterStatus(''); setFilterCurrency(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterPOOnly(false); }}>
              Clear All
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Wings</th>
                <th>Date</th>
                <th>Due</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>PO</th>
                <th>Status</th>
                <th>File</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>Loading…</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={10} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>No invoices found</td></tr>
              ) : displayed.map(inv => (
                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setModal(inv.id)}>
                  <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td style={{ fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.client_name || <span className="text-muted">—</span>}</td>
                  <td><WingBadges inv={inv}/></td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{formatDate(inv.invoice_date)}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 600, fontSize: 13 }}>{formatCurrency(inv.total_amount, inv.currency)}</div>
                    {inv.currency !== 'PKR' && <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatCurrency(inv.pkr_equivalent, 'PKR')}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.po_number || '—'}</td>
                  <td><span className={`badge ${statusBadgeClass(inv.status?.toLowerCase())}`}>{inv.status}</span></td>
                  <td>
                    <span className={`badge ${inv.has_file ? 'badge-success' : 'badge-neutral'}`}>
                      {inv.has_file ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => setModal(inv.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {(modal === 'import' || modal === 'new') && (
        <InvoiceWizard
          wings={wings}
          mode={modal === 'import' ? 'import' : 'manual'}
          onClose={closeModal}
          onSaved={afterSave}
        />
      )}
      {modal && isUUID(modal) && (
        <InvoiceDetail
          invoiceId={modal}
          wings={wings}
          onClose={closeModal}
          onRefresh={load}
        />
      )}
    </div>
  );
}

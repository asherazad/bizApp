import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, statusBadgeClass } from '../../lib/format';
import { Plus, Upload, Filter, RefreshCcw, Inbox, X } from 'lucide-react';
import InvoiceWizard from './InvoiceWizard';
import InvoiceDetail from './InvoiceDetail';

const STATUSES   = ['', 'Pending', 'Received', 'Overdue', 'Disputed'];
const CURRENCIES = ['', 'PKR', 'USD', 'EUR', 'AED', 'GBP'];

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

// ─── Wave Import Modal (finalize one staged invoice) ─────────────────────────
function WaveImportModal({ staged, wings, onClose, onSaved }) {
  const toast = useToast();
  const { activeWing } = useAuth();
  const [saving, setSaving]           = useState(false);
  const [pos, setPos]                 = useState([]);
  const [clientName, setClientName]   = useState(staged.client_name || '');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [wingMode, setWingMode]       = useState('single');
  const [singleWingId, setSingleWingId] = useState(activeWing?.id || '');
  const [splits, setSplits]           = useState([
    { id: 1, wing_id: '', amount: '', pct: '' },
    { id: 2, wing_id: '', amount: '', pct: '' },
  ]);
  const [poId, setPoId] = useState('');

  const total      = parseFloat(staged.total_amount || 0);
  const splitTotal = splits.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const splitValid = Math.abs(splitTotal - total) < 0.02;

  useEffect(() => {
    api.get('/purchase-orders').then(r => setPos(r.data)).catch(() => {});
  }, []);

  function updateSplit(id, field, val) {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = { ...s, [field]: val };
      if (field === 'pct')    next.amount = total > 0 ? (parseFloat(val || 0) / 100 * total).toFixed(2) : '';
      if (field === 'amount') next.pct    = total > 0 ? (parseFloat(val || 0) / total * 100).toFixed(2) : '';
      return next;
    }));
  }

  async function submit(e) {
    e.preventDefault();
    if (wingMode === 'single' && !singleWingId)
      return toast('Please select a business wing', 'error');
    if (wingMode === 'split' && !splitValid)
      return toast(`Split amounts must sum to ${formatCurrency(total, staged.currency)}`, 'error');

    setSaving(true);
    try {
      const body = {
        wing_assignment_mode: wingMode,
        client_name:   clientName,
        exchange_rate: parseFloat(exchangeRate) || 1,
        po_id:         poId || null,
      };
      if (wingMode === 'single') {
        body.wing_id = singleWingId;
      } else {
        body.wing_splits = splits.filter(s => s.wing_id).map(s => ({
          business_wing_id: s.wing_id,
          split_percentage: parseFloat(s.pct),
          split_amount:     parseFloat(s.amount),
        }));
      }
      await api.post(`/wave/staging/${staged.id}/finalize`, body);
      toast('Invoice imported successfully', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Import failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Review & Import — {staged.invoice_number}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <form onSubmit={submit} style={{ display: 'contents' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Invoice summary from Wave */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>From Wave</div>
              {[
                ['Invoice #',    staged.invoice_number],
                ['Wave Status',  staged.wave_status || '—'],
                ['Date',         formatDate(staged.invoice_date)],
                staged.due_date && ['Due Date', formatDate(staged.due_date)],
              ].filter(Boolean).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="text-muted">{l}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                <span className="text-muted">Total</span>
                <strong className="font-mono">{formatCurrency(staged.total_amount, staged.currency)}</strong>
              </div>
            </div>

            {/* Editable fields */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Client Name</label>
              <input className="form-control" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name"/>
            </div>

            {staged.currency !== 'PKR' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Exchange Rate — 1 {staged.currency} = ? PKR</label>
                <input type="number" step="0.0001" min="0" className="form-control" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)}/>
              </div>
            )}

            {/* Wing assignment */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Assign to Business Wing *</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['single', 'split'].map(m => (
                  <button key={m} type="button"
                    className={`btn btn-sm ${wingMode === m ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setWingMode(m)}>
                    {m === 'single' ? 'Single Wing' : 'Split Between Wings'}
                  </button>
                ))}
              </div>

              {wingMode === 'single' && (
                <select className="form-control" value={singleWingId} onChange={e => setSingleWingId(e.target.value)}>
                  <option value="">— Select Wing —</option>
                  {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}

              {wingMode === 'split' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <span>Wing</span><span>Split %</span><span>Amount ({staged.currency})</span><span/>
                  </div>
                  {splits.map(s => (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: 6, alignItems: 'center' }}>
                      <select className="form-control" value={s.wing_id} onChange={e => updateSplit(s.id, 'wing_id', e.target.value)}>
                        <option value="">— Wing —</option>
                        {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <input type="number" step="0.01" className="form-control" placeholder="%" value={s.pct} onChange={e => updateSplit(s.id, 'pct', e.target.value)}/>
                      <input type="number" step="0.01" className="form-control" placeholder="Amount" value={s.amount} onChange={e => updateSplit(s.id, 'amount', e.target.value)}/>
                      {splits.length > 2
                        ? <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px 8px' }} onClick={() => setSplits(p => p.filter(r => r.id !== s.id))}><X size={12}/></button>
                        : <div/>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setSplits(p => [...p, { id: Date.now(), wing_id: '', pct: '', amount: '' }])}>
                      <Plus size={12}/> Add Wing
                    </button>
                    {total > 0 && (
                      <span style={{ fontSize: 12, color: splitValid ? 'var(--success)' : 'var(--danger)' }}>
                        Allocated {formatCurrency(splitTotal, staged.currency)} of {formatCurrency(total, staged.currency)}
                        {splitValid ? ' ✓' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PO link */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Link to Purchase Order (optional)</label>
              <select className="form-control" value={poId} onChange={e => setPoId(e.target.value)}>
                <option value="">— No PO —</option>
                {pos.map(p => <option key={p.id} value={p.id}>PO #{p.po_number} · {formatCurrency(p.po_value, p.currency)}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Importing…' : 'Import Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Wave Queue Modal (list of staged invoices) ───────────────────────────────
function WaveQueueModal({ wings, onClose, onImported }) {
  const [staging, setStaging]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [importing, setImporting] = useState(null);

  const loadStaging = useCallback(async () => {
    setLoading(true);
    try { setStaging((await api.get('/wave/staging')).data); }
    catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStaging(); }, [loadStaging]);

  return (
    <>
      <div className="modal-overlay" onClick={importing ? undefined : onClose}>
        <div className="modal" style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h3>Wave Import Queue</h3>
              {!loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{staging.length} invoice{staging.length !== 1 ? 's' : ''} pending review</div>}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
          </div>

          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading…</div>
            ) : staging.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                <Inbox size={36} style={{ marginBottom: 12, opacity: 0.35 }}/>
                <div style={{ fontWeight: 600 }}>Queue is empty</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Sync with Wave to import new invoices</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Due</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Wave Status</th>
                      <th/>
                    </tr>
                  </thead>
                  <tbody>
                    {staging.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.invoice_number}</td>
                        <td style={{ fontSize: 13 }}>{s.client_name || <span className="text-muted">—</span>}</td>
                        <td className="text-muted" style={{ fontSize: 12 }}>{formatDate(s.invoice_date)}</td>
                        <td className="text-muted" style={{ fontSize: 12 }}>{s.due_date ? formatDate(s.due_date) : '—'}</td>
                        <td style={{ textAlign: 'right' }} className="font-mono">{formatCurrency(s.total_amount, s.currency)}</td>
                        <td><span className="badge badge-neutral" style={{ fontSize: 11 }}>{s.wave_status || '—'}</span></td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => setImporting(s)}>
                            Review & Import
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {importing && (
        <WaveImportModal
          staged={importing}
          wings={wings}
          onClose={() => setImporting(null)}
          onSaved={() => { setImporting(null); loadStaging(); onImported(); }}
        />
      )}
    </>
  );
}

// ─── Main Invoices page ───────────────────────────────────────────────────────
export default function Invoices() {
  const { activeWing, wings } = useAuth();
  const toast                 = useToast();

  const [invoices, setInvoices]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null);
  const [syncing, setSyncing]         = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [queueOpen, setQueueOpen]     = useState(false);

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

  async function loadPendingCount() {
    try {
      const { data } = await api.get('/wave/staging');
      setPendingCount(data.length);
    } catch {}
  }

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPendingCount(); }, []);

  async function syncWave() {
    setSyncing(true);
    try {
      const { data } = await api.post('/wave/sync');
      setPendingCount(data.pending);
      if (data.imported === 0) {
        toast(`No new invoices — ${data.skipped} already synced`, 'info');
      } else {
        toast(`${data.imported} new invoice${data.imported > 1 ? 's' : ''} added to review queue`, 'success');
        setQueueOpen(true);
      }
    } catch (err) {
      toast(err.response?.data?.error || 'Wave sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }

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
          {/* Wave queue button — only visible when there are pending items */}
          {pendingCount > 0 && (
            <button className="btn btn-secondary" onClick={() => setQueueOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Inbox size={14}/>
              Wave Queue
              <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
                {pendingCount}
              </span>
            </button>
          )}
          <button className="btn btn-secondary" onClick={syncWave} disabled={syncing}>
            <RefreshCcw size={14} style={syncing ? { animation: 'spin 1s linear infinite' } : {}}/>
            {syncing ? 'Syncing…' : 'Sync Wave'}
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
                  <td>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {inv.invoice_number}
                      {inv.source === 'wave' && (
                        <span style={{ fontSize: 10, background: '#2979ff22', color: '#2979ff', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>Wave</span>
                      )}
                    </div>
                  </td>
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
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => setModal(inv.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
      {queueOpen && (
        <WaveQueueModal
          wings={wings}
          onClose={() => setQueueOpen(false)}
          onImported={() => { load(); loadPendingCount(); }}
        />
      )}
    </div>
  );
}

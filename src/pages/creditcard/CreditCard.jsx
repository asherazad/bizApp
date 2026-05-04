import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Pencil, Trash2, Paperclip, ExternalLink, X } from 'lucide-react';

const CATEGORIES = ['office', 'travel', 'meals', 'utilities', 'subscriptions', 'equipment', 'marketing', 'other'];

// ─── Modal ────────────────────────────────────────────────────────────────────
function TxnModal({ txn, wings, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!txn?.id;
  const fileRef = useRef();

  const [form, setForm] = useState({
    txn_date:    txn?.txn_date?.split('T')[0]  || new Date().toISOString().split('T')[0],
    merchant:    txn?.merchant    || '',
    amount:      txn?.amount      || '',
    currency:    txn?.currency    || 'PKR',
    category:    txn?.category    || '',
    wing_id:     txn?.business_wing_id || '',
    notes:       txn?.notes       || '',
    status:      txn?.status      || 'pending',
  });
  const [file, setFile]       = useState(null);
  const [saving, setSaving]   = useState(false);

  function f(k) { return (e) => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('invoice', file);

      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (isEdit) await api.put(`/creditcard/${txn.id}`, fd, cfg);
      else        await api.post('/creditcard', fd, cfg);

      toast(isEdit ? 'Updated' : 'Transaction saved', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || err.response?.data?.detail || 'Error', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit' : 'New'} Credit Card Transaction</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Date + Merchant */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-control" required value={form.txn_date} onChange={f('txn_date')} />
              </div>
              <div className="form-group">
                <label className="form-label">Merchant *</label>
                <input className="form-control" required placeholder="e.g. Amazon, Shell" value={form.merchant} onChange={f('merchant')} />
              </div>
            </div>

            {/* Amount + Category */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount (PKR) *</label>
                <input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={form.category} onChange={f('category')}>
                  <option value="">— Select —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{formatStatus(c)}</option>)}
                </select>
              </div>
            </div>

            {/* Wing + Status */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Business Wing</label>
                <select className="form-control" value={form.wing_id} onChange={f('wing_id')}>
                  <option value="">— Unassigned —</option>
                  {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={f('status')}>
                  <option value="pending">Pending</option>
                  <option value="reconciled">Reconciled</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" placeholder="Brief Notes" value={form.notes} onChange={f('notes')} />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={f('notes')} />
            </div>

            {/* Invoice upload */}
            <div className="form-group">
              <label className="form-label">Invoice / Receipt</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files[0] || null)}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => fileRef.current.click()}>
                  <Paperclip size={13} style={{ marginRight: 4 }} />
                  {file ? 'Change file' : 'Attach file'}
                </button>
                {file && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {file.name}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => { setFile(null); fileRef.current.value = ''; }} />
                  </span>
                )}
                {!file && txn?.invoice_filename && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Current: {txn.invoice_filename}
                  </span>
                )}
              </div>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CreditCard() {
  const { wings } = useAuth();
  const toast = useToast();

  const [txns, setTxns]               = useState([]);
  const [ccBalance, setCCBalance]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // filters
  const [filterWing, setFilterWing]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  async function load() {
    setLoading(true);
    const params = {};
    if (filterWing)   params.wing_id = filterWing;
    if (filterStatus) params.status  = filterStatus;
    if (filterMonth)  params.month   = filterMonth;
    try {
      const [txnsRes, balRes] = await Promise.all([
        api.get('/creditcard', { params }),
        api.get('/creditcard/balance').catch(() => ({ data: null })),
      ]);
      setTxns(txnsRes.data);
      setCCBalance(balRes.data);
    }
    catch { toast('Failed to load transactions', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [filterWing, filterStatus, filterMonth]);

  async function deleteTxn(id) {
    try {
      await api.delete(`/creditcard/${id}`);
      toast('Deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch {
      toast('Error deleting', 'error');
    }
  }

  // summary stats
  const debits  = txns.filter(t => (t.txn_type || 'debit') === 'debit');
  const credits = txns.filter(t => t.txn_type === 'credit');
  const total   = debits.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const pending = txns.filter(t => t.status === 'pending').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const byWing  = debits.reduce((acc, t) => {
    const key = t.wing_name || 'Unassigned';
    acc[key] = (acc[key] || 0) + parseFloat(t.amount || 0);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h1>Credit Card</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15}/> New Transaction</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {ccBalance && (
          <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--electric-border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--electric)', letterSpacing: '0.5px', marginBottom: 6 }}>CC Balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: parseFloat(ccBalance.current_balance) < 5000 ? 'var(--danger)' : 'inherit' }}>
              {formatCurrency(ccBalance.current_balance, ccBalance.currency)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ccBalance.name}</div>
          </div>
        )}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 6 }}>Total Spend</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(total)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{debits.length} debit transaction{debits.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 6 }}>Pending</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>{formatCurrency(pending)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{txns.filter(t => t.status === 'pending').length} unreconciled</div>
        </div>
        {Object.entries(byWing).slice(0, 3).map(([name, amt]) => (
          <div key={name} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 6 }}>{name}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(amt)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {Math.round((amt / total) * 100) || 0}% of total
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 180 }} value={filterWing} onChange={e => setFilterWing(e.target.value)}>
          <option value="">All Wings</option>
          {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className="form-control" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <input type="month" className="form-control" style={{ width: 160 }} value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)} placeholder="Month" />
        {(filterWing || filterStatus || filterMonth) && (
          <button className="btn btn-secondary btn-sm"
            onClick={() => { setFilterWing(''); setFilterStatus(''); setFilterMonth(''); }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th>Wing</th>
                <th>Notes</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>Invoice</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : txns.length === 0
                  ? <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No transactions</td></tr>
                  : txns.map(t => (
                    <tr key={t.id}>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.txn_date)}</td>
                      <td style={{ fontWeight: 500 }}>{t.merchant}</td>
                      <td className="text-muted">{t.category ? formatStatus(t.category) : '—'}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{t.wing_name || <span style={{ color: 'var(--warning)' }}>Unassigned</span>}</td>
                      <td className="text-muted" style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.notes || '—'}
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 600 }}>{formatCurrency(t.amount, t.currency)}</td>
                      <td>
                        <span className={`badge ${t.status === 'reconciled' ? 'badge-success' : 'badge-warning'}`}>
                          {formatStatus(t.status)}
                        </span>
                      </td>
                      <td>
                        {t.invoice_url
                          ? <a href={t.invoice_url} target="_blank" rel="noreferrer"
                              className="btn btn-secondary btn-sm btn-icon" title={t.invoice_filename}>
                              <ExternalLink size={12}/>
                            </a>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(t)} title="Edit">
                          <Pencil size={13}/>
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }}
                          onClick={() => setDeleteTarget(t)} title="Delete">
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {modal !== null && (
        <TxnModal
          txn={modal?.id ? modal : null}
          wings={wings}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Transaction</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete <strong>{deleteTarget.merchant}</strong> — {formatCurrency(deleteTarget.amount)}?</p>
              <p className="text-muted" style={{ fontSize: 13 }}>This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteTxn(deleteTarget.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

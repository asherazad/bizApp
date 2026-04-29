import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Trash2 } from 'lucide-react';

function defaultDueDate() {
  const now = new Date();
  const target = now.getDate() <= 10
    ? new Date(now.getFullYear(), now.getMonth(), 10)
    : new Date(now.getFullYear(), now.getMonth() + 1, 10);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-10`;
}

function BillModal({ wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: '', bill_type: '', description: '', amount: '', bill_date: new Date().toISOString().split('T')[0], due_date: defaultDueDate(), reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.post('/bills', form); toast('Bill added', 'success'); onSaved(); }
    catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Add Bill</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}><option value="">Select…</option>{wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              </div>
              <div className="form-group"><label className="form-label">Bill Type *</label>
                <input className="form-control" required placeholder="Electricity, Internet, Rent…" value={form.bill_type} onChange={f('bill_type')} />
              </div>
            </div>
            <div className="form-group"><label className="form-label">Description *</label>
              <input className="form-control" required placeholder="e.g. PTCL Broadband — May 2026" value={form.description} onChange={f('description')} />
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Amount (PKR) *</label><input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} /></div>
              <div className="form-group"><label className="form-label">Reference</label><input className="form-control" placeholder="Invoice / bill no." value={form.reference} onChange={f('reference')} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Bill Date *</label><input type="date" className="form-control" required value={form.bill_date} onChange={f('bill_date')} /></div>
              <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-control" value={form.due_date} onChange={f('due_date')} /></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><input className="form-control" value={form.notes} onChange={f('notes')} /></div>
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

function PayBillModal({ bill, onClose, onDone }) {
  const toast = useToast();
  const [accounts,      setAccounts]      = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentDate,   setPaymentDate]   = useState(new Date().toISOString().split('T')[0]);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    api.get('/banks/accounts').then(r => setAccounts(r.data)).catch(() => {});
  }, []);

  async function confirm() {
    if (!bankAccountId) { toast('Select a bank account', 'error'); return; }
    setSaving(true);
    try {
      await api.put(`/bills/${bill.id}`, { status: 'paid', payment_date: paymentDate, bank_account_id: bankAccountId });
      toast('Bill paid — bank debited', 'success');
      onDone();
    } catch (err) {
      toast(err.response?.data?.detail || err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Pay Bill</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{bill.bill_type}</div>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>{bill.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted" style={{ fontSize: 12 }}>Due</span>
              <span style={{ fontSize: 12 }}>{formatDate(bill.due_date)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Amount</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(bill.amount)}</span>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Debit from Bank Account *</label>
            <select className="form-control" required value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.bank_name} — {a.account_title} ({formatCurrency(a.current_balance, a.currency)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Payment Date</label>
            <input type="date" className="form-control" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={confirm} disabled={saving || !bankAccountId}>
              {saving ? 'Processing…' : `Pay ${formatCurrency(bill.amount)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Bills() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [bills,       setBills]       = useState([]);
  const [modal,       setModal]       = useState(false);
  const [payTarget,   setPayTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading,     setLoading]     = useState(true);

  async function deleteBill(id) {
    try {
      await api.delete(`/bills/${id}`);
      toast('Bill deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Error deleting bill', 'error');
    }
  }

  async function load() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { setBills((await api.get('/bills', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing]);

  return (
    <div>
      <div className="page-header">
        <h1>Bill Payments</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> Add Bill</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Bill Type</th><th>Description</th><th>Bill Date</th><th>Due Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : bills.length === 0 ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No bills</td></tr>
                : bills.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500 }}>{b.bill_type}</td>
                    <td className="text-muted">{b.description || '—'}</td>
                    <td className="text-muted">{formatDate(b.bill_date)}</td>
                    <td className="text-muted">{formatDate(b.due_date)}</td>
                    <td className="font-mono">{formatCurrency(b.amount)}</td>
                    <td><span className={`badge ${statusBadgeClass(b.status)}`}>{formatStatus(b.status)}</span></td>
                    <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {b.status !== 'paid' && <button className="btn btn-primary btn-sm" onClick={() => setPayTarget(b)}>Pay</button>}
                      {b.status !== 'paid' && <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger, #dc3545)' }} onClick={() => setDeleteTarget(b)} title="Delete"><Trash2 size={13} /></button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal        && <BillModal    wings={wings} onClose={() => setModal(false)}       onSaved={() => { setModal(false); load(); }} />}
      {payTarget    && <PayBillModal bill={payTarget} onClose={() => setPayTarget(null)}   onDone={() => { setPayTarget(null); load(); }} />}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Delete Bill</h3><button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>✕</button></div>
            <div className="modal-body">
              <p>Delete <strong>{deleteTarget.bill_type}</strong> — {deleteTarget.description}?</p>
              <p className="text-muted" style={{ fontSize: 13 }}>This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteBill(deleteTarget.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

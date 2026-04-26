import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus } from 'lucide-react';

function BillModal({ wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: '', category: '', amount: '', currency_code: 'PKR', exchange_rate: '1', bill_date: new Date().toISOString().split('T')[0], due_date: '', notes: '' });
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
              <div className="form-group"><label className="form-label">Category *</label><input className="form-control" required placeholder="Electricity, Internet, Rent…" value={form.category} onChange={f('category')} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Amount *</label><input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} /></div>
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>{['PKR','USD','EUR','AED','GBP'].map((c) => <option key={c}>{c}</option>)}</select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Bill Date *</label><input type="date" className="form-control" required value={form.bill_date} onChange={f('bill_date')} /></div>
              <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-control" value={form.due_date} onChange={f('due_date')} /></div>
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

export default function Bills() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [bills, setBills] = useState([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { setBills((await api.get('/bills', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing]);

  async function markPaid(bill) {
    try {
      await api.put(`/bills/${bill.id}`, { status: 'paid', paid_date: new Date().toISOString().split('T')[0] });
      toast('Marked as paid', 'success'); load();
    } catch { toast('Error', 'error'); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Bill Payments</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> Add Bill</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Category</th><th>Vendor</th><th>Date</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : bills.length === 0 ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No bills</td></tr>
                : bills.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500 }}>{b.category}</td>
                    <td className="text-muted">{b.vendor_name || '—'}</td>
                    <td className="text-muted">{formatDate(b.bill_date)}</td>
                    <td className="text-muted">{formatDate(b.due_date)}</td>
                    <td className="font-mono">{formatCurrency(b.pkr_amount)}</td>
                    <td><span className={`badge ${statusBadgeClass(b.status)}`}>{formatStatus(b.status)}</span></td>
                    <td>{b.status === 'pending' && <button className="btn btn-secondary btn-sm" onClick={() => markPaid(b)}>Mark Paid</button>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <BillModal wings={wings} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

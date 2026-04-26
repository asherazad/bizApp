import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { Plus } from 'lucide-react';

function SubModal({ wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: '', service_name: '', description: '', amount: '', currency_code: 'PKR', exchange_rate: '1', billing_cycle: 'monthly', next_billing_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.post('/subscriptions', form); toast('Subscription added', 'success'); onSaved(); }
    catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Add Subscription</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label className="form-label">Wing *</label>
              <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}><option value="">Select…</option>{wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
            </div>
            <div className="form-group"><label className="form-label">Service Name *</label><input className="form-control" required placeholder="AWS, GitHub, Slack…" value={form.service_name} onChange={f('service_name')} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Amount *</label><input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} /></div>
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>{['PKR','USD','EUR','AED','GBP'].map((c) => <option key={c}>{c}</option>)}</select>
              </div>
            </div>
            {form.currency_code !== 'PKR' && <div className="form-group"><label className="form-label">Exchange Rate</label><input type="number" step="0.0001" className="form-control" value={form.exchange_rate} onChange={f('exchange_rate')} /></div>}
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Billing Cycle</label>
                <select className="form-control" value={form.billing_cycle} onChange={f('billing_cycle')}>
                  {['monthly','quarterly','semi_annual','annual'].map((c) => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Next Billing Date *</label><input type="date" className="form-control" required value={form.next_billing_date} onChange={f('next_billing_date')} /></div>
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

export default function Subscriptions() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [subs, setSubs]   = useState([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { setSubs((await api.get('/subscriptions', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing]);

  return (
    <div>
      <div className="page-header">
        <h1>Monthly Subscriptions</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> Add Subscription</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Service</th><th>Wing</th><th>Amount</th><th>PKR</th><th>Cycle</th><th>Next Billing</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : subs.length === 0 ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No subscriptions</td></tr>
                : subs.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.service_name}</td>
                    <td className="text-muted">{s.wing_name}</td>
                    <td className="font-mono">{formatCurrency(s.amount, s.currency_code)}</td>
                    <td className="font-mono">{formatCurrency(s.pkr_amount)}</td>
                    <td className="text-muted">{s.billing_cycle}</td>
                    <td>{formatDate(s.next_billing_date)}</td>
                    <td><span className={`badge ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>{s.is_active ? 'Active' : 'Paused'}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <SubModal wings={wings} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

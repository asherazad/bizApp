import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Pencil } from 'lucide-react';

function TaxModal({ challan, wings, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!challan?.id;
  const [form, setForm] = useState({
    wing_id: challan?.wing_id || '', challan_number: challan?.challan_number || '',
    tax_type: challan?.tax_type || 'sales_tax', period_start: challan?.period_start?.split('T')[0] || '',
    period_end: challan?.period_end?.split('T')[0] || '', taxable_amount: challan?.taxable_amount || '',
    tax_amount: challan?.tax_amount || '', penalty: challan?.penalty || '0',
    due_date: challan?.due_date?.split('T')[0] || '', notes: challan?.notes || '',
    status: challan?.status || 'pending', paid_date: challan?.paid_date?.split('T')[0] || '',
  });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) await api.put(`/tax/${challan.id}`, form);
      else        await api.post('/tax', form);
      toast(isEdit ? 'Updated' : 'Created', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>{isEdit ? 'Edit' : 'New'} Tax Challan</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}><option value="">Select…</option>{wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              </div>
              <div className="form-group"><label className="form-label">Tax Type *</label>
                <select className="form-control" required value={form.tax_type} onChange={f('tax_type')}>
                  {['sales_tax','income_tax','salary_tax','advance_tax','withholding_tax','other'].map((t) => <option key={t} value={t}>{formatStatus(t)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Period Start *</label><input type="date" className="form-control" required value={form.period_start} onChange={f('period_start')} /></div>
              <div className="form-group"><label className="form-label">Period End *</label><input type="date" className="form-control" required value={form.period_end} onChange={f('period_end')} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Tax Amount (PKR) *</label><input type="number" step="0.01" className="form-control" required value={form.tax_amount} onChange={f('tax_amount')} /></div>
              <div className="form-group"><label className="form-label">Penalty</label><input type="number" step="0.01" className="form-control" value={form.penalty} onChange={f('penalty')} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-control" value={form.due_date} onChange={f('due_date')} /></div>
              <div className="form-group"><label className="form-label">Challan #</label><input className="form-control" value={form.challan_number} onChange={f('challan_number')} /></div>
            </div>
            {isEdit && (
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={f('status')}>
                    {['pending','paid','overdue','disputed'].map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Paid Date</label><input type="date" className="form-control" value={form.paid_date} onChange={f('paid_date')} /></div>
              </div>
            )}
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

export default function Tax() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [challans, setChallans] = useState([]);
  const [modal, setModal]       = useState(null);
  const [loading, setLoading]   = useState(true);

  async function load() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { setChallans((await api.get('/tax', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing]);

  return (
    <div>
      <div className="page-header">
        <h1>Tax & Challans</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15}/> New Challan</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Challan #</th><th>Type</th><th>Period</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : challans.length === 0 ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No challans</td></tr>
                : challans.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.challan_number || '—'}</td>
                    <td>{formatStatus(c.tax_type)}</td>
                    <td className="text-muted">{formatDate(c.period_start)} – {formatDate(c.period_end)}</td>
                    <td className="font-mono">{formatCurrency(c.tax_amount)}</td>
                    <td className="text-muted">{formatDate(c.due_date)}</td>
                    <td><span className={`badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span></td>
                    <td><button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(c)}><Pencil size={13}/></button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal !== null && <TaxModal challan={modal?.id ? modal : null} wings={wings} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

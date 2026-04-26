import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus } from 'lucide-react';

function POModal({ wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: '', vendor_id: '', po_number: '', currency_code: 'PKR', exchange_rate: '1', order_date: new Date().toISOString().split('T')[0], expected_date: '', notes: '' });
  const [items, setItems] = useState([{ description: '', quantity: '1', unit_price: '', amount: '' }]);
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  function setItem(i, k, v) { setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [k]: v, amount: k === 'unit_price' ? (parseFloat(v || 0) * parseFloat(it.quantity || 1)).toFixed(2) : it.amount } : it)); }

  useEffect(() => {
    if (form.wing_id) api.get('/clients', { params: { wing_id: form.wing_id, type: 'vendor' } }).then((r) => setVendors(r.data)).catch(() => {});
  }, [form.wing_id]);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/purchase-orders', { ...form, items: items.map((it) => ({ ...it, quantity: parseFloat(it.quantity || 1), unit_price: parseFloat(it.unit_price || 0), amount: parseFloat(it.amount || 0) })) });
      toast('PO created', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>New Purchase Order</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}><option value="">Select…</option>{wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              </div>
              <div className="form-group"><label className="form-label">Vendor</label>
                <select className="form-control" value={form.vendor_id || ''} onChange={f('vendor_id')}><option value="">None</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">PO # *</label><input className="form-control" required value={form.po_number} onChange={f('po_number')} /></div>
              <div className="form-group"><label className="form-label">Order Date *</label><input type="date" className="form-control" required value={form.order_date} onChange={f('order_date')} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>{['PKR','USD','EUR','AED','GBP'].map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="form-group"><label className="form-label">Expected Date</label><input type="date" className="form-control" value={form.expected_date} onChange={f('expected_date')} /></div>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Items</label>
              {items.map((it, i) => (
                <div key={i} className="grid-3" style={{ marginBottom: 6 }}>
                  <input className="form-control" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                  <input type="number" className="form-control" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                  <input type="number" className="form-control" placeholder="Unit Price" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems((p) => [...p, { description: '', quantity: '1', unit_price: '', amount: '' }])}><Plus size={12}/> Add Line</button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create PO'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [pos, setPOs]     = useState([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { setPOs((await api.get('/purchase-orders', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing]);

  return (
    <div>
      <div className="page-header">
        <h1>Purchase Orders</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> New PO</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>PO #</th><th>Vendor</th><th>Date</th><th>Total</th><th>Invoiced</th><th>Remaining</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : pos.length === 0 ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No purchase orders</td></tr>
                : pos.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.po_number}</td>
                    <td>{p.vendor_name || '—'}</td>
                    <td className="text-muted">{formatDate(p.order_date)}</td>
                    <td className="font-mono">{formatCurrency(p.total_amount, p.currency_code)}</td>
                    <td className="font-mono">{formatCurrency(p.invoiced_amount, p.currency_code)}</td>
                    <td className="font-mono" style={{ color: 'var(--amber-dark)' }}>{formatCurrency(p.total_amount - p.invoiced_amount, p.currency_code)}</td>
                    <td><span className={`badge ${statusBadgeClass(p.status)}`}>{formatStatus(p.status)}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <POModal wings={wings} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

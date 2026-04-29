import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Pencil } from 'lucide-react';

function POModal({ po, wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    wing_id:       po?.wing_id       || '',
    vendor_id:     po?.vendor_id     || '',
    po_title:      po?.po_title      || '',
    po_number:     po?.po_number     || '',
    currency_code: po?.currency_code || 'PKR',
    exchange_rate: po?.exchange_rate || '1',
    order_date:    po?.order_date    || new Date().toISOString().split('T')[0],
    expected_date: po?.expected_date || '',
    status:        po?.status        || 'draft',
    notes:         po?.notes         || '',
  });
  const [items, setItems] = useState(
    po?.items?.length
      ? po.items.map((it) => ({ description: it.description, quantity: String(it.quantity), unit_price: String(it.unit_price), amount: String(it.amount) }))
      : [{ description: '', quantity: '1', unit_price: '', amount: '' }]
  );
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);

  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  function setItem(i, k, v) {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, [k]: v };
      if (k === 'unit_price' || k === 'quantity') {
        next.amount = (parseFloat(k === 'unit_price' ? v : it.unit_price) || 0) *
                      (parseFloat(k === 'quantity'   ? v : it.quantity)   || 1);
        next.amount = next.amount.toFixed(2);
      }
      return next;
    }));
  }

  useEffect(() => {
    if (form.wing_id) {
      api.get('/clients', { params: { wing_id: form.wing_id, type: 'vendor' } })
        .then((r) => setVendors(r.data)).catch(() => {});
    }
  }, [form.wing_id]);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      const mappedItems = items.map((it) => ({
        description: it.description,
        quantity:    parseFloat(it.quantity)   || 1,
        unit_price:  parseFloat(it.unit_price) || 0,
        amount:      parseFloat(it.amount)     || 0,
      }));
      const total_amount = mappedItems.reduce((sum, it) => sum + it.amount, 0);
      const payload = { ...form, total_amount };

      if (po) {
        await api.put(`/purchase-orders/${po.id}`, payload);
        toast('PO updated', 'success');
      } else {
        await api.post('/purchase-orders', { ...payload, items: mappedItems });
        toast('PO created', 'success');
      }
      onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  const isEdit = !!po;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}>
                  <option value="">Select…</option>
                  {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Vendor</label>
                <select className="form-control" value={form.vendor_id} onChange={f('vendor_id')}>
                  <option value="">None</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">PO Title</label>
              <input className="form-control" placeholder="e.g. Annual IT Equipment Supply" value={form.po_title} onChange={f('po_title')} />
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">PO # *</label>
                <input className="form-control" required value={form.po_number} onChange={f('po_number')} />
              </div>
              <div className="form-group"><label className="form-label">Order Date *</label>
                <input type="date" className="form-control" required value={form.order_date} onChange={f('order_date')} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>
                  {['PKR', 'USD', 'EUR', 'AED', 'GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Expected Date</label>
                <input type="date" className="form-control" value={form.expected_date} onChange={f('expected_date')} />
              </div>
            </div>
            {isEdit && (
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={f('status')}>
                  {['draft', 'sent', 'acknowledged', 'partially_invoiced', 'fully_invoiced', 'cancelled'].map((s) => (
                    <option key={s} value={s}>{formatStatus(s)}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Items</label>
              {items.map((it, i) => (
                <div key={i} className="grid-3" style={{ marginBottom: 6 }}>
                  <input className="form-control" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                  <input type="number" className="form-control" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                  <input type="number" className="form-control" placeholder="Unit Price" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems((p) => [...p, { description: '', quantity: '1', unit_price: '', amount: '' }])}>
                <Plus size={12} /> Add Line
              </button>
            </div>
            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create PO'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [pos, setPOs]       = useState([]);
  const [modal, setModal]   = useState(null); // null | 'new' | po-object
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { setPOs((await api.get('/purchase-orders', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [activeWing]);

  async function openEdit(po) {
    try {
      const { data } = await api.get(`/purchase-orders/${po.id}`);
      setModal(data);
    } catch { toast('Failed to load PO', 'error'); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Purchase Orders</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> New PO</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Title</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Total</th>
                <th>Invoiced</th>
                <th>Remaining</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : pos.length === 0
                  ? <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No purchase orders</td></tr>
                  : pos.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.po_number}</td>
                      <td className="text-muted">{p.po_title || '—'}</td>
                      <td>{p.vendor_name || '—'}</td>
                      <td className="text-muted">{formatDate(p.order_date)}</td>
                      <td className="font-mono">{formatCurrency(p.total_amount, p.currency_code)}</td>
                      <td className="font-mono">{formatCurrency(p.invoiced_amount, p.currency_code)}</td>
                      <td className="font-mono" style={{ color: 'var(--amber-dark)' }}>{formatCurrency(p.total_amount - p.invoiced_amount, p.currency_code)}</td>
                      <td><span className={`badge ${statusBadgeClass(p.status)}`}>{formatStatus(p.status)}</span></td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} title="Edit">
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <POModal
          po={modal === 'new' ? null : modal}
          wings={wings}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

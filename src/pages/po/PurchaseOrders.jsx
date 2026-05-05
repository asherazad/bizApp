import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Pencil } from 'lucide-react';

function toDateInput(val) {
  if (!val) return '';
  return String(val).slice(0, 10);
}

function POModal({ po, wings, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!po;

  const [form, setForm] = useState({
    wing_id:     po?.business_wing_id || '',
    client_id:   po?.client_id        || '',
    po_title:    po?.po_title         || '',
    po_number:   po?.po_number        || '',
    currency:    po?.currency         || 'PKR',
    exchange_rate: String(po?.exchange_rate ?? 1),
    issue_date:  toDateInput(po?.issue_date)  || new Date().toISOString().split('T')[0],
    expiry_date: toDateInput(po?.expiry_date) || '',
    po_value:    String(po?.po_value  ?? ''),
    status:      po?.status           || 'active',
    notes:       po?.notes            || '',
  });
  const [items, setItems] = useState([{ description: '', quantity: '1', unit_price: '', amount: '' }]);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);

  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  function setItem(i, k, v) {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, [k]: v };
      if (k === 'unit_price' || k === 'quantity') {
        const price = parseFloat(k === 'unit_price' ? v : it.unit_price) || 0;
        const qty   = parseFloat(k === 'quantity'   ? v : it.quantity)   || 1;
        next.amount = (price * qty).toFixed(2);
      }
      return next;
    }));
  }

  useEffect(() => {
    if (form.wing_id) {
      api.get('/clients', { params: { wing_id: form.wing_id } })
        .then((r) => setClients(r.data)).catch(() => {});
    }
  }, [form.wing_id]);

  // Keep po_value in sync with items total (create mode only)
  useEffect(() => {
    if (isEdit) return;
    const total = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
    if (total > 0) setForm((p) => ({ ...p, po_value: total.toFixed(2) }));
  }, [items, isEdit]);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/purchase-orders/${po.id}`, {
          po_title:     form.po_title,
          po_number:    form.po_number,
          client_id:    form.client_id  || null,
          currency:     form.currency,
          exchange_rate: form.exchange_rate,
          po_value:     form.po_value,
          issue_date:   form.issue_date,
          expiry_date:  form.expiry_date || null,
          notes:        form.notes,
        });
        toast('PO updated', 'success');
      } else {
        await api.post('/purchase-orders', {
          wing_id:      form.wing_id,
          client_id:    form.client_id  || null,
          po_title:     form.po_title,
          po_number:    form.po_number,
          currency:     form.currency,
          exchange_rate: form.exchange_rate,
          po_value:     form.po_value,
          issue_date:   form.issue_date,
          expiry_date:  form.expiry_date || null,
          notes:        form.notes,
        });
        toast('PO created', 'success');
      }
      onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

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
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')} disabled={isEdit}>
                  <option value="">Select…</option>
                  {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Client / Vendor</label>
                <select className="form-control" value={form.client_id} onChange={f('client_id')}>
                  <option value="">None</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <div className="form-group"><label className="form-label">Issue Date *</label>
                <input type="date" className="form-control" required value={form.issue_date} onChange={f('issue_date')} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency} onChange={f('currency')}>
                  {['PKR', 'USD', 'EUR', 'AED', 'GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Expiry Date</label>
                <input type="date" className="form-control" value={form.expiry_date} onChange={f('expiry_date')} />
              </div>
            </div>

            {/* Line items (create) or direct value input (edit) */}
            {isEdit ? (
              <div className="form-group"><label className="form-label">PO Value *</label>
                <input type="number" className="form-control" required value={form.po_value} onChange={f('po_value')} />
              </div>
            ) : (
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Items</label>
                {items.map((it, i) => (
                  <div key={i} className="grid-3" style={{ marginBottom: 6 }}>
                    <input className="form-control" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                    <input type="number" className="form-control" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                    <input type="number" className="form-control" placeholder="Unit Price" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems((p) => [...p, { description: '', quantity: '1', unit_price: '', amount: '' }])}>
                    <Plus size={12} /> Add Line
                  </button>
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    Total: <strong>{formatCurrency(form.po_value, form.currency)}</strong>
                  </span>
                </div>
              </div>
            )}

            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [pos, setPOs]         = useState([]);
  const [modal, setModal]     = useState(null); // null | 'new' | po-object
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
                <th>Client / Vendor</th>
                <th>Date</th>
                <th>Value</th>
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
                      <td>{p.client_name || '—'}</td>
                      <td className="text-muted">{formatDate(p.issue_date)}</td>
                      <td className="font-mono">{formatCurrency(p.po_value, p.currency)}</td>
                      <td className="font-mono">{formatCurrency(p.invoiced_amount || 0, p.currency)}</td>
                      <td className="font-mono" style={{ color: 'var(--amber-dark)' }}>
                        {formatCurrency(parseFloat(p.po_value || 0) - parseFloat(p.invoiced_amount || 0), p.currency)}
                      </td>
                      <td>
                        {p.expiry_date && new Date(p.expiry_date) < new Date()
                          ? <span className="badge badge-danger">Expired</span>
                          : <span className={`badge ${statusBadgeClass(p.status)}`}>{formatStatus(p.status)}</span>
                        }
                      </td>
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

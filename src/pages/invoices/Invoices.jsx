import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Eye } from 'lucide-react';

function InvoiceModal({ wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: '', invoice_number: '', currency_code: 'PKR', exchange_rate: '1', tax_rate: '0', issue_date: new Date().toISOString().split('T')[0], due_date: '', notes: '' });
  const [items, setItems] = useState([{ description: '', quantity: '1', unit_price: '', amount: '' }]);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  function setItem(i, k, v) { setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [k]: v, amount: k === 'unit_price' ? (parseFloat(v || 0) * parseFloat(it.quantity || 1)).toFixed(2) : k === 'quantity' ? (parseFloat(it.unit_price || 0) * parseFloat(v || 1)).toFixed(2) : (k === 'amount' ? v : it.amount) } : it)); }
  function addItem() { setItems((p) => [...p, { description: '', quantity: '1', unit_price: '', amount: '' }]); }

  useEffect(() => {
    if (form.wing_id) api.get('/clients', { params: { wing_id: form.wing_id } }).then((r) => setClients(r.data)).catch(() => {});
  }, [form.wing_id]);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/invoices', { ...form, items: items.map((it) => ({ ...it, quantity: parseFloat(it.quantity), unit_price: parseFloat(it.unit_price), amount: parseFloat(it.amount) })) });
      toast('Invoice created', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>New Invoice</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}>
                  <option value="">Select…</option>{wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Client</label>
                <select className="form-control" value={form.client_id || ''} onChange={f('client_id')}>
                  <option value="">None</option>{clients.filter((c) => c.type !== 'vendor').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Invoice # *</label><input className="form-control" required value={form.invoice_number} onChange={f('invoice_number')} /></div>
              <div className="form-group"><label className="form-label">Issue Date *</label><input type="date" className="form-control" required value={form.issue_date} onChange={f('issue_date')} /></div>
            </div>
            <div className="grid-3">
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>
                  {['PKR','USD','EUR','AED','GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {form.currency_code !== 'PKR' && <div className="form-group"><label className="form-label">Exchange Rate</label><input type="number" step="0.0001" className="form-control" value={form.exchange_rate} onChange={f('exchange_rate')} /></div>}
              <div className="form-group"><label className="form-label">Tax %</label><input type="number" step="0.01" className="form-control" value={form.tax_rate} onChange={f('tax_rate')} /></div>
              <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-control" value={form.due_date} onChange={f('due_date')} /></div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Line Items</label>
              {items.map((it, i) => (
                <div key={i} className="grid-3" style={{ marginBottom: 6, alignItems: 'end' }}>
                  <div className="form-group" style={{ gridColumn: 'span 1' }}><input className="form-control" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} /></div>
                  <div className="form-group"><input type="number" className="form-control" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} /></div>
                  <div className="form-group"><input type="number" className="form-control" placeholder="Unit Price" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} /></div>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={12}/> Add Line</button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Invoice'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Invoices() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [modal, setModal]       = useState(false);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const params = {};
    if (activeWing?.id) params.wing_id = activeWing.id;
    if (statusFilter) params.status = statusFilter;
    try { setInvoices((await api.get('/invoices', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing, statusFilter]);

  return (
    <div>
      <div className="page-header">
        <h1>Invoices</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> New Invoice</button>
      </div>

      <div className="flex gap-2 mb-4">
        {['','draft','sent','partially_paid','fully_paid','overdue'].map((s) => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
            {s === '' ? 'All' : formatStatus(s)}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Due</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : invoices.length === 0
                  ? <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No invoices</td></tr>
                  : invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                      <td>{inv.client_name || '—'}</td>
                      <td className="text-muted">{formatDate(inv.issue_date)}</td>
                      <td className="text-muted">{formatDate(inv.due_date)}</td>
                      <td className="font-mono">{formatCurrency(inv.total, inv.currency_code)}</td>
                      <td className="font-mono">{formatCurrency(inv.paid_amount, inv.currency_code)}</td>
                      <td className="font-mono" style={{ color: 'var(--danger)' }}>{formatCurrency(inv.total - inv.paid_amount, inv.currency_code)}</td>
                      <td><span className={`badge ${statusBadgeClass(inv.status)}`}>{formatStatus(inv.status)}</span></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <InvoiceModal wings={wings} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

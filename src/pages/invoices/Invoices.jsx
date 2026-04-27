import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Eye, CreditCard, Send, X, Trash2 } from 'lucide-react';

const CURRENCIES = ['PKR', 'USD', 'EUR', 'AED', 'GBP'];
const STATUSES   = ['', 'draft', 'sent', 'partially_paid', 'fully_paid', 'overdue', 'cancelled'];
const EMPTY_ITEM = { description: '', notes: '', quantity: '1', unit_price: '', amount: '' };

// ─── helpers ──────────────────────────────────────────────────────────────────
function calcItem(item, key, val) {
  const next = { ...item, [key]: val };
  if (key === 'unit_price' || key === 'quantity') {
    next.amount = (parseFloat(next.unit_price || 0) * parseFloat(next.quantity || 1)).toFixed(2);
  }
  return next;
}

function calcTotals(items, taxRate) {
  const subtotal = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const taxAmt   = subtotal * ((parseFloat(taxRate) || 0) / 100);
  return { subtotal, taxAmt, total: subtotal + taxAmt };
}

// ─── PaymentModal ─────────────────────────────────────────────────────────────
function PaymentModal({ invoice, onClose, onSaved }) {
  const toast = useToast();
  const [banks, setBanks]   = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({
    bank_account_id: '', amount: String(parseFloat(invoice.total) - parseFloat(invoice.paid_amount || 0)),
    currency_code: invoice.currency_code || 'PKR', exchange_rate: '1',
    paid_date: new Date().toISOString().split('T')[0], reference: '', notes: '',
  });
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  useEffect(() => {
    api.get('/banks').then((r) => setBanks(r.data)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/invoices/${invoice.id}/payments`, {
        ...form, amount: parseFloat(form.amount), exchange_rate: parseFloat(form.exchange_rate),
      });
      toast('Payment recorded', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error saving payment', 'error'); }
    finally { setSaving(false); }
  }

  const outstanding = parseFloat(invoice.total) - parseFloat(invoice.paid_amount || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Record Payment — #{invoice.invoice_number}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              <span className="text-muted">Outstanding: </span>
              <strong style={{ color: 'var(--danger)' }}>{formatCurrency(outstanding, invoice.currency_code)}</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Bank Account</label>
              <select className="form-control" value={form.bank_account_id} onChange={f('bank_account_id')}>
                <option value="">— Cash / Unlinked —</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.bank_name} · {b.account_title} ({b.currency_code})</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-control" required value={form.paid_date} onChange={f('paid_date')}/>
              </div>
            </div>
            {form.currency_code !== 'PKR' && (
              <div className="form-group">
                <label className="form-label">Exchange Rate to PKR</label>
                <input type="number" step="0.0001" className="form-control" value={form.exchange_rate} onChange={f('exchange_rate')}/>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Reference / Cheque #</label>
              <input className="form-control" placeholder="e.g. TRF-001" value={form.reference} onChange={f('reference')}/>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={f('notes')}/>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── InvoiceDetail ────────────────────────────────────────────────────────────
function InvoiceDetail({ invoiceId, wings, onClose, onRefresh }) {
  const toast = useToast();
  const [inv, setInv]           = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try { setInv((await api.get(`/invoices/${invoiceId}`)).data); }
    catch { toast('Failed to load invoice', 'error'); }
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.put(`/invoices/${invoiceId}`, { status });
      toast(`Status → ${formatStatus(status)}`, 'success');
      load(); onRefresh();
    } catch { toast('Update failed', 'error'); }
    finally { setUpdating(false); }
  }

  if (!inv) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    </div>
  );

  const outstanding = parseFloat(inv.total) - parseFloat(inv.paid_amount || 0);
  const wing = wings.find((w) => w.id === inv.wing_id);

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Invoice #{inv.invoice_number}</h3>
            <div className="flex gap-2">
              <span className={`badge ${statusBadgeClass(inv.status)}`}>{formatStatus(inv.status)}</span>
              <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
            </div>
          </div>

          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header info */}
            <div className="grid-2" style={{ gap: 8 }}>
              {[
                ['Wing',         wing?.name || '—'],
                ['Client',       inv.client_name || '—'],
                ['Invoice Date', formatDate(inv.issue_date)],
                ['Due Date',     formatDate(inv.due_date) || '—'],
                ['Currency',     inv.currency_code],
                ['PO Ref',       inv.po_id ? `#${inv.po_id}` : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Line items */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Line Items</div>
              <table className="table" style={{ fontSize: 13 }}>
                <thead>
                  <tr><th style={{ width: '45%' }}>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {(inv.items || []).map((it, i) => (
                    <tr key={i}>
                      <td>
                        <div>{it.description}</div>
                        {it.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.notes}</div>}
                      </td>
                      <td className="font-mono">{it.quantity}</td>
                      <td className="font-mono">{formatCurrency(it.unit_price, inv.currency_code)}</td>
                      <td className="font-mono">{formatCurrency(it.amount, inv.currency_code)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 280, background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Subtotal',    formatCurrency(inv.subtotal, inv.currency_code), false],
                  [`Tax (${inv.tax_rate}%)`, formatCurrency(inv.tax_amount, inv.currency_code), false],
                  ['Total',       formatCurrency(inv.total, inv.currency_code), true],
                  ['Paid',        formatCurrency(inv.paid_amount, inv.currency_code), false],
                  ['Outstanding', formatCurrency(outstanding, inv.currency_code), false, outstanding > 0 ? 'var(--danger)' : 'var(--success)'],
                ].map(([label, value, bold, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid var(--border)' : 'none', paddingTop: bold ? 6 : 0 }}>
                    <span className="text-muted">{label}</span>
                    <span className="font-mono" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment history */}
            {(inv.payments || []).length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Payment History</div>
                <table className="table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Date</th><th>Amount</th><th>Bank</th><th>Reference</th></tr></thead>
                  <tbody>
                    {inv.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.paid_date)}</td>
                        <td className="font-mono">{formatCurrency(p.amount, p.currency_code)}</td>
                        <td>{p.bank_name || 'Cash'}</td>
                        <td className="text-muted">{p.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inv.notes && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <strong>Notes:</strong> {inv.notes}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div className="flex gap-2">
              {inv.status === 'draft' && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('sent')}>
                  <Send size={13}/> Mark Sent
                </button>
              )}
              {['sent', 'partially_paid'].includes(inv.status) && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('overdue')}>
                  Mark Overdue
                </button>
              )}
              {inv.status === 'overdue' && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('sent')}>
                  Revert to Sent
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {outstanding > 0 && !['cancelled', 'fully_paid'].includes(inv.status) && (
                <button className="btn btn-primary btn-sm" onClick={() => setPayModal(true)}>
                  <CreditCard size={13}/> Record Payment
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {payModal && (
        <PaymentModal
          invoice={inv}
          onClose={() => setPayModal(false)}
          onSaved={() => { setPayModal(false); load(); onRefresh(); }}
        />
      )}
    </>
  );
}

// ─── InvoiceForm ──────────────────────────────────────────────────────────────
function InvoiceForm({ wings, onClose, onSaved }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [items, setItems]     = useState([{ ...EMPTY_ITEM }]);
  const [form, setForm]       = useState({
    wing_id: wings[0]?.id || '', client_id: '', invoice_number: '',
    po_number: '', currency_code: 'PKR', exchange_rate: '1', tax_rate: '5',
    issue_date: new Date().toISOString().split('T')[0], due_date: '', notes: '',
  });

  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  useEffect(() => {
    if (form.wing_id) api.get('/clients', { params: { wing_id: form.wing_id } }).then((r) => setClients(r.data)).catch(() => {});
  }, [form.wing_id]);

  function setItem(i, key, val) { setItems((p) => p.map((it, idx) => idx === i ? calcItem(it, key, val) : it)); }
  function addItem()    { setItems((p) => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(i) { setItems((p) => p.filter((_, idx) => idx !== i)); }

  const { subtotal, taxAmt, total } = calcTotals(items, form.tax_rate);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/invoices', {
        ...form,
        exchange_rate: parseFloat(form.exchange_rate) || 1,
        tax_rate: parseFloat(form.tax_rate) || 0,
        items: items.map((it) => ({
          description: it.description,
          notes: it.notes,
          quantity:   parseFloat(it.quantity)   || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          amount:     parseFloat(it.amount)     || 0,
        })),
      });
      toast('Invoice created', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error creating invoice', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 740 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Invoice</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Wing + Client */}
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}>
                  <option value="">Select…</option>
                  {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Client</label>
                <select className="form-control" value={form.client_id || ''} onChange={f('client_id')}>
                  <option value="">— None —</option>
                  {clients.filter((c) => c.type !== 'vendor').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Invoice # + PO # */}
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Invoice # *</label>
                <input className="form-control" required value={form.invoice_number} onChange={f('invoice_number')} placeholder="e.g. 1223"/>
              </div>
              <div className="form-group"><label className="form-label">PO / SO #</label>
                <input className="form-control" value={form.po_number} onChange={f('po_number')} placeholder="e.g. 3124240000"/>
              </div>
            </div>

            {/* Dates */}
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Issue Date *</label>
                <input type="date" className="form-control" required value={form.issue_date} onChange={f('issue_date')}/>
              </div>
              <div className="form-group"><label className="form-label">Due Date</label>
                <input type="date" className="form-control" value={form.due_date} onChange={f('due_date')}/>
              </div>
            </div>

            {/* Currency + Tax */}
            <div className="grid-3">
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {form.currency_code !== 'PKR' && (
                <div className="form-group"><label className="form-label">Exchange Rate → PKR</label>
                  <input type="number" step="0.0001" className="form-control" value={form.exchange_rate} onChange={f('exchange_rate')}/>
                </div>
              )}
              <div className="form-group"><label className="form-label">Tax %</label>
                <input type="number" step="0.01" className="form-control" value={form.tax_rate} onChange={f('tax_rate')}/>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Line Items</div>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'end' }}>
                  <div>
                    <input className="form-control" placeholder="Description *" value={it.description}
                      onChange={(e) => setItem(i, 'description', e.target.value)}/>
                    <input className="form-control" placeholder="Notes (optional)" value={it.notes} style={{ marginTop: 4, fontSize: 12 }}
                      onChange={(e) => setItem(i, 'notes', e.target.value)}/>
                  </div>
                  <input type="number" step="0.001" className="form-control" placeholder="Qty" value={it.quantity}
                    onChange={(e) => setItem(i, 'quantity', e.target.value)}/>
                  <input type="number" step="0.01" className="form-control" placeholder="Rate" value={it.unit_price}
                    onChange={(e) => setItem(i, 'unit_price', e.target.value)}/>
                  <input type="number" step="0.01" className="form-control" placeholder="Amount" value={it.amount}
                    onChange={(e) => setItem(i, 'amount', e.target.value)}/>
                  <div style={{ fontSize: 13, padding: '8px 4px', fontWeight: 500, color: 'var(--navy)' }}>
                    {formatCurrency(parseFloat(it.amount) || 0, form.currency_code)}
                  </div>
                  {items.length > 1 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeItem(i)}
                      style={{ padding: '6px 8px' }}><Trash2 size={13}/></button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: 4 }}>
                <Plus size={12}/> Add Line
              </button>
            </div>

            {/* Running totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 260, background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                {[
                  ['Subtotal',             formatCurrency(subtotal, form.currency_code), false],
                  [`Tax (${form.tax_rate}%)`, formatCurrency(taxAmt, form.currency_code),  false],
                  ['Total',                formatCurrency(total,    form.currency_code), true],
                ].map(([label, value, bold]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid var(--border)' : 'none', paddingTop: bold ? 6 : 0 }}>
                    <span className="text-muted">{label}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')}/>
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Invoices() {
  const { activeWing, wings } = useAuth();
  const toast                 = useToast();
  const [invoices, setInvoices]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal]           = useState(null); // null | 'create' | invoiceId

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (activeWing?.id) params.wing_id = activeWing.id;
    if (statusFilter)   params.status  = statusFilter;
    try { setInvoices((await api.get('/invoices', { params })).data); }
    catch { toast('Failed to load invoices', 'error'); }
    finally { setLoading(false); }
  }, [activeWing, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalOutstanding = invoices.reduce((s, inv) => s + Math.max(0, parseFloat(inv.total) - parseFloat(inv.paid_amount || 0)), 0);
  const overdueCount     = invoices.filter((i) => i.status === 'overdue').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          {invoices.length > 0 && (
            <div style={{ fontSize: 13, marginTop: 2, color: 'var(--text-muted)' }}>
              {invoices.length} invoices · Outstanding: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(totalOutstanding, 'PKR')}</strong>
              {overdueCount > 0 && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>· {overdueCount} overdue</span>}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={15}/> New Invoice</button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(s)}>
            {s === '' ? 'All' : formatStatus(s)}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Client</th><th>Wing</th>
                <th>Date</th><th>Due</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>Loading…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={10} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>No invoices found</td></tr>
              ) : invoices.map((inv) => {
                const outstanding = parseFloat(inv.total) - parseFloat(inv.paid_amount || 0);
                return (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setModal(inv.id)}>
                    <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td>{inv.client_name || <span className="text-muted">—</span>}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{inv.wing_name}</td>
                    <td className="text-muted">{formatDate(inv.issue_date)}</td>
                    <td className="text-muted">{formatDate(inv.due_date) || '—'}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(inv.total, inv.currency_code)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(inv.paid_amount || 0, inv.currency_code)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', color: outstanding > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: outstanding > 0 ? 600 : 400 }}>
                      {formatCurrency(outstanding, inv.currency_code)}
                    </td>
                    <td><span className={`badge ${statusBadgeClass(inv.status)}`}>{formatStatus(inv.status)}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal(inv.id)}><Eye size={13}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'create' && (
        <InvoiceForm wings={wings} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }}/>
      )}
      {modal && modal !== 'create' && (
        <InvoiceDetail invoiceId={modal} wings={wings} onClose={() => setModal(null)} onRefresh={load}/>
      )}
    </div>
  );
}

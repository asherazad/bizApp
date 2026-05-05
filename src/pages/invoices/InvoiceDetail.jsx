import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, statusBadgeClass } from '../../lib/format';
import { X, CheckCircle, AlertTriangle, Trash2, Paperclip, Pencil, Plus } from 'lucide-react';
import InvoiceFileViewer from '../../components/InvoiceFileViewer';

const MODE_LABEL = { single: 'Single Wing', split: 'Split Between Wings', line_item: 'By Line Item' };
const CURRENCIES = ['PKR', 'USD', 'EUR', 'AED', 'GBP'];
const EMPTY_ITEM = { description: '', notes: '', quantity: 1, unit_price: '', amount: '' };

function calcItem(item, key, val) {
  const next = { ...item, [key]: val };
  if (key === 'unit_price' || key === 'quantity')
    next.amount = (parseFloat(next.unit_price || 0) * parseFloat(next.quantity || 1)).toFixed(2);
  return next;
}

// ─── Searchable client dropdown ───────────────────────────────────────────────
function ClientSelect({ value, onChange, clients, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = clients.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  function select(name) { onChange(name); setQuery(name); setOpen(false); }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input className="form-control" value={query} placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
          {filtered.map(c => (
            <div key={c.id} onMouseDown={() => select(c.name)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: c.name === value ? 'var(--electric-light)' : undefined }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = c.name === value ? 'var(--electric-light)' : ''}
            >{c.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditInvoiceModal({ inv, wings, onClose, onSaved }) {
  const toast = useToast();
  const { activeWing } = useAuth();
  const [saving, setSaving]   = useState(false);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const params = {};
    if (activeWing?.id) params.wing_id = activeWing.id;
    api.get('/clients', { params }).then(r => setClients(r.data)).catch(() => {});
  }, [activeWing?.id]);

  const initItems = (() => {
    try { return Array.isArray(inv.line_items) ? inv.line_items : JSON.parse(inv.line_items || '[]'); }
    catch { return []; }
  })();

  const [form, setForm] = useState({
    invoice_number: inv.invoice_number || '',
    vendor_name:    inv.vendor_name    || '',
    client_name:    inv.client_name    || '',
    invoice_date:   inv.invoice_date?.split('T')[0] || '',
    due_date:       inv.due_date?.split('T')[0]      || '',
    currency:       inv.currency      || 'PKR',
    exchange_rate:  inv.exchange_rate || '1',
    tax_rate:       '',
    tax_amount:     inv.tax_amount    || '0',
    notes:          inv.notes         || '',
  });
  const [lineItems, setLineItems] = useState(initItems.length ? initItems : [{ ...EMPTY_ITEM }]);

  // ── Wing split state ──
  const currentMode   = inv.wing_assignment_mode || 'single';
  const [wingMode, setWingMode]       = useState(currentMode);
  const [singleWingId, setSingleWingId] = useState(inv.business_wing_id || '');
  const [splits, setSplits] = useState(() => {
    if (inv.wing_splits?.length) {
      return inv.wing_splits.map(s => ({
        id:       s.business_wing_id,
        wing_id:  s.business_wing_id,
        amount:   String(s.split_amount || ''),
        pct:      String(s.split_percentage || ''),
      }));
    }
    return [
      { id: 1, wing_id: '', amount: '', pct: '' },
      { id: 2, wing_id: '', amount: '', pct: '' },
    ];
  });

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }
  function setItem(i, key, val) { setLineItems(p => p.map((it, idx) => idx === i ? calcItem(it, key, val) : it)); }
  function addItem()     { setLineItems(p => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(i) { setLineItems(p => p.filter((_, idx) => idx !== i)); }

  const subtotal   = lineItems.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const taxAmt     = parseFloat(form.tax_amount || 0);
  const total      = subtotal + taxAmt;
  const splitTotal = splits.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const splitValid = splits.length > 0 && Math.abs(splitTotal - total) < 0.02;

  function updateSplit(id, field, val) {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = { ...s, [field]: val };
      if (field === 'pct')    next.amount = total > 0 ? (parseFloat(val || 0) / 100 * total).toFixed(2) : '';
      if (field === 'amount') next.pct    = total > 0 ? (parseFloat(val || 0) / total * 100).toFixed(2) : '';
      return next;
    }));
  }

  async function submit(e) {
    e.preventDefault();
    if (wingMode === 'split' && !splitValid)
      return toast(`Split amounts must sum to ${formatCurrency(total, form.currency)}`, 'error');

    setSaving(true);
    try {
      // 1 — update fields + line items
      await api.put(`/invoices/${inv.id}`, {
        invoice_number: form.invoice_number,
        vendor_name:    form.vendor_name  || null,
        client_name:    form.client_name  || null,
        invoice_date:   form.invoice_date,
        due_date:       form.due_date     || null,
        currency:       form.currency,
        exchange_rate:  parseFloat(form.exchange_rate) || 1,
        tax_amount:     parseFloat(form.tax_amount)    || 0,
        line_items:     lineItems,
        notes:          form.notes        || null,
      });

      // 2 — update wing assignment
      const wingBody = { wing_assignment_mode: wingMode };
      if (wingMode === 'single') {
        wingBody.wing_id = singleWingId;
      } else if (wingMode === 'split') {
        wingBody.wing_splits = splits.filter(s => s.wing_id).map(s => ({
          business_wing_id: s.wing_id,
          split_percentage: parseFloat(s.pct),
          split_amount:     parseFloat(s.amount),
        }));
      }
      await api.patch(`/invoices/${inv.id}/wing-assignment`, wingBody);

      toast('Invoice updated', 'success');
      onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 780, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Invoice #{inv.invoice_number}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <form onSubmit={submit} style={{ display: 'contents' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Basic fields ── */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Invoice # *</label>
                <input className="form-control" required value={form.invoice_number} onChange={f('invoice_number')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Client</label>
                <ClientSelect value={form.vendor_name} onChange={v => setForm(p => ({ ...p, vendor_name: v }))} clients={clients} placeholder="Select or type client"/>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Bill To</label>
              <ClientSelect value={form.client_name} onChange={v => setForm(p => ({ ...p, client_name: v }))} clients={clients} placeholder="Select or type bill-to"/>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Invoice Date *</label>
                <input type="date" className="form-control" required value={form.invoice_date} onChange={f('invoice_date')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-control" value={form.due_date} onChange={f('due_date')}/>
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-control" value={form.currency} onChange={f('currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              {form.currency !== 'PKR' && (
                <div className="form-group">
                  <label className="form-label">Exchange Rate → PKR</label>
                  <input type="number" step="0.0001" className="form-control" value={form.exchange_rate} onChange={f('exchange_rate')}/>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Tax Rate</label>
                <select className="form-control" value={form.tax_rate} onChange={e => {
                  const rate = e.target.value;
                  setForm(p => ({ ...p, tax_rate: rate, tax_amount: rate ? (subtotal * parseFloat(rate) / 100).toFixed(2) : p.tax_amount }));
                }}>
                  <option value="">Custom</option>
                  {[0, 5, 10, 15, 16, 17, 20].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tax Amount ({form.currency})</label>
                <input type="number" step="0.01" className="form-control" value={form.tax_amount} placeholder="0"
                  onChange={e => setForm(p => ({ ...p, tax_rate: '', tax_amount: e.target.value }))}/>
              </div>
            </div>

            {/* ── Line items ── */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Line Items</div>
              {lineItems.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'start' }}>
                  <div>
                    <input className="form-control" placeholder="Description" value={it.description} onChange={e => setItem(i, 'description', e.target.value)}/>
                    <input className="form-control" placeholder="Notes" value={it.notes || ''} style={{ marginTop: 4, fontSize: 12 }} onChange={e => setItem(i, 'notes', e.target.value)}/>
                  </div>
                  <input type="number" step="0.001" className="form-control" placeholder="Qty"    value={it.quantity}   onChange={e => setItem(i, 'quantity',   e.target.value)}/>
                  <input type="number" step="0.01"  className="form-control" placeholder="Rate"   value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)}/>
                  <input type="number" step="0.01"  className="form-control" placeholder="Amount" value={it.amount}     onChange={e => setItem(i, 'amount',     e.target.value)}/>
                  {lineItems.length > 1
                    ? <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px 8px' }} onClick={() => removeItem(i)}><X size={12}/></button>
                    : <div/>}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={12}/> Add Line</button>
            </div>

            {/* ── Totals ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 260, background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                {[['Subtotal', subtotal, false], ['Tax', taxAmt, false], ['Total', total, true]].map(([l, v, b]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: b ? 700 : 400, borderTop: b ? '1px solid var(--border)' : 'none', paddingTop: b ? 6 : 0, marginTop: b ? 4 : 0 }}>
                    <span className="text-muted">{l}</span>
                    <span className="font-mono">{formatCurrency(v, form.currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Wing assignment ── */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Wing Assignment</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['single', 'split'].map(m => (
                  <button key={m} type="button"
                    className={`btn btn-sm ${wingMode === m ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setWingMode(m)}
                  >
                    {m === 'single' ? 'Single Wing' : 'Split Between Wings'}
                  </button>
                ))}
              </div>

              {wingMode === 'single' && (
                <select className="form-control" value={singleWingId} onChange={e => setSingleWingId(e.target.value)}>
                  <option value="">— Select Wing —</option>
                  {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}

              {wingMode === 'split' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <span>Wing</span><span>Split %</span><span>Amount ({form.currency})</span><span/>
                  </div>
                  {splits.map(s => (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: 6, alignItems: 'center' }}>
                      <select className="form-control" value={s.wing_id} onChange={e => updateSplit(s.id, 'wing_id', e.target.value)}>
                        <option value="">— Wing —</option>
                        {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <input type="number" step="0.01" className="form-control" placeholder="%" value={s.pct} onChange={e => updateSplit(s.id, 'pct', e.target.value)}/>
                      <input type="number" step="0.01" className="form-control" placeholder="Amount" value={s.amount} onChange={e => updateSplit(s.id, 'amount', e.target.value)}/>
                      {splits.length > 2
                        ? <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px 8px' }} onClick={() => setSplits(p => p.filter(r => r.id !== s.id))}><X size={12}/></button>
                        : <div/>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSplits(p => [...p, { id: Date.now(), wing_id: '', pct: '', amount: '' }])}>
                      <Plus size={12}/> Add Wing
                    </button>
                    {total > 0 && (
                      <span style={{ fontSize: 12, color: splitValid ? 'var(--success)' : 'var(--danger)' }}>
                        Allocated {formatCurrency(splitTotal, form.currency)} of {formatCurrency(total, form.currency)}
                        {splitValid ? ' ✓' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')}/>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Receive Modal ────────────────────────────────────────────────────────────
function ReceiveModal({ invoice, wings, onClose, onSaved }) {
  const toast = useToast();
  const [banks, setBanks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    received_date: new Date().toISOString().split('T')[0],
    received_bank_account_id: '',
    notes: '',
  });
  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  useEffect(() => {
    api.get('/banks/accounts').then(r => setBanks(r.data)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.patch(`/invoices/${invoice.id}/status`, { status: 'Received', ...form });
      toast('Invoice marked as Received', 'success');
      onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Mark Received — #{invoice.invoice_number}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'var(--bg)', padding:'10px 14px', borderRadius:8, fontSize:13 }}>
              <span className="text-muted">Amount: </span>
              <strong>{formatCurrency(invoice.total_amount, invoice.currency)}</strong>
              {invoice.currency !== 'PKR' && <span className="text-muted"> · {formatCurrency(invoice.pkr_equivalent, 'PKR')}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Bank Account (optional)</label>
              <select className="form-control" value={form.received_bank_account_id} onChange={f('received_bank_account_id')}>
                <option value="">— Cash / Unspecified —</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} · {b.account_title} ({b.currency})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date Received *</label>
              <input type="date" className="form-control" required value={form.received_date} onChange={f('received_date')}/>
            </div>
            <div className="form-group">
              <label className="form-label">Reference / Notes</label>
              <input className="form-control" placeholder="e.g. Wire ref TT-12345" value={form.notes} onChange={f('notes')}/>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Mark Received'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Invoice Detail ───────────────────────────────────────────────────────────
export default function InvoiceDetail({ invoiceId, wings, onClose, onRefresh }) {
  const toast = useToast();
  const [inv, setInv]                   = useState(null);
  const [receiveModal, setReceive]      = useState(false);
  const [editOpen, setEditOpen]         = useState(false);
  const [updating, setUpdating]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [attaching, setAttaching]       = useState(false);
  const fileRef                         = useRef(null);

  async function attachFile(file) {
    if (!file) return;
    setAttaching(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/invoices/${invoiceId}/file`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast('File attached successfully', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deleteInvoice() {
    setDeleting(true);
    try {
      await api.delete(`/invoices/${invoiceId}`);
      toast('Invoice deleted', 'success');
      onClose();
      onRefresh();
    } catch (err) {
      toast(err.response?.data?.error || 'Delete failed', 'error');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const load = useCallback(async () => {
    try { setInv((await api.get(`/invoices/${invoiceId}`)).data); }
    catch { toast('Failed to load invoice', 'error'); }
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.patch(`/invoices/${invoiceId}/status`, { status });
      toast(`Status changed to ${status}`, 'success');
      load(); onRefresh();
    } catch (err) { toast(err.response?.data?.error || 'Update failed', 'error'); }
    finally { setUpdating(false); }
  }

  if (!inv) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    </div>
  );

  const lineItems = (() => {
    try { return Array.isArray(inv.line_items) ? inv.line_items : JSON.parse(inv.line_items||'[]'); }
    catch { return []; }
  })();

  const wing_splits  = inv.wing_splits || [];
  const mode         = inv.wing_assignment_mode || 'single';
  const canEdit      = ['Pending','Disputed'].includes(inv.status);

  // Build wing breakdown rows
  const wingBreakdown = (() => {
    if (mode === 'single') {
      return [{ name: inv.wing_name || '—', amount: parseFloat(inv.total_amount||0), pct: 100, pkr: parseFloat(inv.pkr_equivalent||0) }];
    }
    return wing_splits.map(s => ({
      name: s.wing_name,
      amount: parseFloat(s.split_amount||0),
      pct: parseFloat(s.split_percentage||0),
      pkr: parseFloat(s.pkr_equivalent||0),
    }));
  })();

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 780, maxHeight: '92vh', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h3>Invoice #{inv.invoice_number}</h3>
              <span className={`badge ${statusBadgeClass(inv.status?.toLowerCase())}`}>{inv.status}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {/* Hidden file input for attach */}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff"
                style={{ display:'none' }}
                onChange={e => { if (e.target.files[0]) attachFile(e.target.files[0]); }}
              />
              {inv.has_file ? (
                <InvoiceFileViewer
                  invoiceId={invoiceId}
                  fileName={inv.source_file_name}
                  fileType={inv.source_file_type}
                  fileSize={inv.source_file_size}
                  trigger="button"
                />
              ) : (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={attaching}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip size={13}/> {attaching ? 'Uploading…' : 'Attach File'}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
            </div>
          </div>

          <div className="modal-body" style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:20 }}>

            {/* ── SECTION 1: Header ── */}
            <section>
              <div style={{ fontSize:11, textTransform:'uppercase', fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>Invoice Details</div>
              <div className="grid-2" style={{ gap:8 }}>
                {[
                  ['Vendor',        inv.vendor_name || '—'],
                  ['Client',        inv.client_name || '—'],
                  ['Invoice Date',  formatDate(inv.invoice_date)],
                  ['Due Date',      inv.due_date ? formatDate(inv.due_date) : '—'],
                  ['Currency',      inv.currency],
                  ['Exchange Rate', inv.currency !== 'PKR' ? `1 ${inv.currency} = ${parseFloat(inv.exchange_rate||1).toFixed(4)} PKR` : '—'],
                  ['Total Amount',  formatCurrency(inv.total_amount, inv.currency)],
                  ['PKR Equiv',     inv.currency !== 'PKR' ? formatCurrency(inv.pkr_equivalent, 'PKR') : '—'],
                  ['Tax',           formatCurrency(inv.tax_amount||0, inv.currency)],
                  ['PO Reference',  inv.po_number || '—'],
                  inv.status === 'Received' && ['Received Date',  formatDate(inv.received_date)],
                  inv.status === 'Received' && ['Received Into',  inv.received_bank_name ? `${inv.received_bank_name} — ${inv.received_account_title}` : 'Cash / Unspecified'],
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} style={{ background:'var(--bg)', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:2 }}>{label}</div>
                    <div style={{ fontWeight:500 }}>{value}</div>
                  </div>
                ))}
              </div>
              {inv.notes && (
                <div style={{ marginTop:8, fontSize:13, color:'var(--text-muted)', background:'var(--bg)', borderRadius:8, padding:'8px 12px' }}>
                  <strong>Notes:</strong> {inv.notes}
                </div>
              )}
            </section>

            {/* ── SECTION 2: Line Items ── */}
            {lineItems.length > 0 && (
              <section>
                <div style={{ fontSize:11, textTransform:'uppercase', fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>Line Items</div>
                <table className="table" style={{ fontSize:13 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th style={{ textAlign:'right' }}>Qty</th>
                      <th style={{ textAlign:'right' }}>Unit Price</th>
                      <th style={{ textAlign:'right' }}>Amount</th>
                      {mode === 'line_item' && <th>Wing</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((it, i) => {
                      const itemWing = mode === 'line_item' ? wings.find(w => w.id === it.business_wing_id) : null;
                      return (
                        <tr key={i}>
                          <td className="text-muted" style={{ fontSize:12 }}>{i+1}</td>
                          <td>
                            <div style={{ fontWeight:500 }}>{it.description}</div>
                            {it.notes && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{it.notes}</div>}
                          </td>
                          <td className="font-mono" style={{ textAlign:'right' }}>{it.quantity}</td>
                          <td className="font-mono" style={{ textAlign:'right' }}>{formatCurrency(it.unit_price, inv.currency)}</td>
                          <td className="font-mono" style={{ textAlign:'right', fontWeight:600 }}>{formatCurrency(it.amount, inv.currency)}</td>
                          {mode === 'line_item' && (
                            <td>
                              {itemWing
                                ? <span className="badge badge-neutral" style={{ fontSize:11 }}>{itemWing.name}</span>
                                : <span style={{ fontSize:11, color:'var(--text-muted)' }}>—</span>
                              }
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                  <div style={{ minWidth:260, background:'var(--bg)', borderRadius:10, padding:'12px 16px', fontSize:13 }}>
                    {[
                      ['Subtotal', parseFloat(inv.total_amount||0) - parseFloat(inv.tax_amount||0), false],
                      ['Tax',     parseFloat(inv.tax_amount||0), false],
                      ['Total',   parseFloat(inv.total_amount||0), true],
                    ].map(([l,v,b]) => (
                      <div key={l} style={{ display:'flex', justifyContent:'space-between', fontWeight:b?700:400, borderTop:b?'1px solid var(--border)':'none', paddingTop:b?6:0, marginTop:b?4:0 }}>
                        <span className="text-muted">{l}</span>
                        <span className="font-mono">{formatCurrency(v, inv.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── SECTION 3: Wing Breakdown ── */}
            <section>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ fontSize:11, textTransform:'uppercase', fontWeight:700, color:'var(--text-muted)' }}>
                  Wing Assignment — <span style={{ color:'var(--navy)' }}>{MODE_LABEL[mode] || mode}</span>
                </div>
              </div>
              <table className="table" style={{ fontSize:13 }}>
                <thead>
                  <tr>
                    <th>Wing</th>
                    <th style={{ textAlign:'right' }}>Amount ({inv.currency})</th>
                    {inv.currency !== 'PKR' && <th style={{ textAlign:'right' }}>PKR Equiv</th>}
                    <th style={{ textAlign:'right' }}>% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {wingBreakdown.map(row => (
                    <tr key={row.name}>
                      <td style={{ fontWeight:500 }}>{row.name}</td>
                      <td className="font-mono" style={{ textAlign:'right' }}>{formatCurrency(row.amount, inv.currency)}</td>
                      {inv.currency !== 'PKR' && <td className="font-mono" style={{ textAlign:'right', color:'var(--text-muted)' }}>{formatCurrency(row.pkr, 'PKR')}</td>}
                      <td className="font-mono" style={{ textAlign:'right' }}>{row.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* ── SECTION 4: PO & Status ── */}
            {inv.po_id && (
              <section>
                <div style={{ fontSize:11, textTransform:'uppercase', fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>Purchase Order</div>
                <div style={{ background:'var(--bg)', borderRadius:10, padding:'14px 16px', display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700 }}>PO #{inv.po_number}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Total: {formatCurrency(inv.po_value, inv.po_currency||inv.currency)}</div>
                  </div>
                  <div style={{ flex:1, fontSize:13 }}>
                    <div>Already invoiced: <strong>{formatCurrency(inv.po_already_invoiced||0, inv.po_currency||inv.currency)}</strong></div>
                    <div style={{ marginTop:4 }}>
                      Remaining after this: <strong style={{ color: inv.po_remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(Math.abs(inv.po_remaining||0), inv.po_currency||inv.currency)}
                        {inv.po_remaining < 0 ? ' (over budget)' : ''}
                      </strong>
                    </div>
                  </div>
                  {inv.po_remaining < 0 && (
                    <div style={{ width:'100%', background:'var(--warning-light)', borderRadius:8, padding:'8px 12px', fontSize:12, display:'flex', gap:8, alignItems:'center' }}>
                      <AlertTriangle size={14} color="var(--warning-text)"/>
                      This invoice exceeds the PO balance by {formatCurrency(Math.abs(inv.po_remaining), inv.po_currency||inv.currency)}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Footer actions */}
          <div className="modal-footer" style={{ justifyContent:'space-between' }}>
            <div className="flex gap-2">
              {/* Delete — show confirm prompt inline */}
              {!confirmDelete && inv.status !== 'Received' && (
                <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={13}/> Delete
                </button>
              )}
              {confirmDelete && (
                <>
                  <span style={{ fontSize:12, color:'var(--danger)', alignSelf:'center', fontWeight:600 }}>Delete permanently?</span>
                  <button className="btn btn-danger btn-sm" disabled={deleting} onClick={deleteInvoice}>
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </>
              )}
              {/* Status transitions */}
              {!confirmDelete && canEdit && inv.status === 'Pending' && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('Overdue')}>Mark Overdue</button>
              )}
              {!confirmDelete && canEdit && inv.status === 'Overdue' && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('Pending')}>Revert to Pending</button>
              )}
              {!confirmDelete && canEdit && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('Disputed')}>Mark Disputed</button>
              )}
              {!confirmDelete && canEdit && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
                  <Pencil size={13}/> Edit
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {!confirmDelete && ['Pending','Overdue'].includes(inv.status) && (
                <button className="btn btn-primary btn-sm" onClick={() => setReceive(true)}>
                  <CheckCircle size={13}/> Mark Received
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {receiveModal && (
        <ReceiveModal
          invoice={inv} wings={wings}
          onClose={() => setReceive(false)}
          onSaved={() => { setReceive(false); load(); onRefresh(); }}
        />
      )}

      {editOpen && (
        <EditInvoiceModal
          inv={inv}
          wings={wings}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); load(); onRefresh(); }}
        />
      )}
    </>
  );
}

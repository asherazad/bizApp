import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Eye, CheckCircle, X, Trash2, Upload } from 'lucide-react';

const CURRENCIES = ['PKR', 'USD', 'EUR', 'AED', 'GBP'];
const STATUSES   = ['', 'Pending', 'Received', 'Overdue', 'Disputed'];
const EMPTY_ITEM = { description: '', notes: '', quantity: 1, unit_price: '', amount: '' };

function calcItem(item, key, val) {
  const next = { ...item, [key]: val };
  if (key === 'unit_price' || key === 'quantity') {
    next.amount = (parseFloat(next.unit_price || 0) * parseFloat(next.quantity || 1)).toFixed(2);
  }
  return next;
}

// ─── PDF Text Extraction ──────────────────────────────────────────────────────
async function extractTextFromPDF(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    fullText += content.items.map((i) => i.str).join(' ') + '\n';
  }
  return fullText;
}

function parseInvoiceText(text) {
  const get = (patterns) => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return m[1]?.trim();
    }
    return '';
  };

  // Parse date strings like "27 April 2026" or "27/04/2026" → YYYY-MM-DD
  function parseDate(str) {
    if (!str) return '';
    const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    // "27 April 2026" / "27th April 2026"
    const m1 = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (m1) {
      const mo = months[m1[2].slice(0,3).toLowerCase()];
      if (mo) return `${m1[3]}-${String(mo).padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
    }
    // "04/27/2026" or "27/04/2026"
    const m2 = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    return '';
  }

  const invoice_number = get([
    /invoice\s*(?:no\.?|number|#)[:\s#]*([A-Z0-9\-]+)/i,
    /inv[\s\-#:]*([A-Z0-9\-]+)/i,
  ]);

  const rawDate = get([
    /(?:invoice\s+)?date[:\s]+([^\n\r,;]+)/i,
    /dated?[:\s]+([^\n\r,;]+)/i,
  ]);
  const invoice_date = parseDate(rawDate);

  const rawDue = get([
    /due\s+date[:\s]+([^\n\r,;]+)/i,
    /payment\s+due[:\s]+([^\n\r,;]+)/i,
  ]);
  const due_date = parseDate(rawDue);

  const vendor_name = get([
    /from[:\s]+([^\n\r]+)/i,
    /(?:bill(?:ed)?\s+)?(?:from|by)[:\s]+([^\n\r]+)/i,
  ]);

  const client_name = get([
    /bill(?:ed)?\s+to[:\s]+([^\n\r]+)/i,
    /(?:to|attn)[:\s]+([^\n\r]+)/i,
    /client[:\s]+([^\n\r]+)/i,
  ]);

  const po_number_ref = get([
    /(?:po|purchase\s+order)\s*(?:no\.?|number|#)?[:\s#]*([A-Z0-9\-]+)/i,
    /order\s*(?:no|number|#)[:\s]*([A-Z0-9\-]+)/i,
  ]);

  // Currency
  const currMatch = text.match(/\b(USD|EUR|GBP|AED|PKR)\b/);
  const currency = currMatch ? currMatch[1] : 'PKR';

  // Tax
  const taxMatch = text.match(/(?:tax|gst|vat|sts)[^\d]*([0-9,]+(?:\.\d{1,2})?)/i);
  const tax_amount = taxMatch ? taxMatch[1].replace(/,/g, '') : '0';

  // NTN/notes
  const ntnMatch = text.match(/ntn[:\s]*([0-9\-]+)/i);
  const notes = ntnMatch ? `NTN: ${ntnMatch[1]}` : '';

  // Line items — look for patterns like "Description  Qty  Rate  Amount"
  const line_items = [];
  // Try to extract rows: text followed by number patterns
  const lineRe = /([A-Za-z][^\d\n]{5,60?})\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/g;
  let m;
  while ((m = lineRe.exec(text)) !== null) {
    const desc = m[1].trim();
    const qty  = parseFloat(m[2].replace(/,/g,''));
    const rate = parseFloat(m[3].replace(/,/g,''));
    const amt  = parseFloat(m[4].replace(/,/g,''));
    // Skip header-like rows and tax rows
    if (/total|subtotal|tax|gst|vat|balance|amount/i.test(desc) && qty < 2) continue;
    if (desc.length < 4) continue;
    line_items.push({ description: desc, notes: '', quantity: qty || 1, unit_price: rate || amt, amount: String(amt || rate) });
  }

  return { invoice_number, invoice_date, due_date, vendor_name, client_name, po_number_ref, currency, tax_amount, notes, line_items };
}

// ─── Receive Payment Modal ────────────────────────────────────────────────────
function ReceiveModal({ invoice, onClose, onSaved }) {
  const toast = useToast();
  const [banks, setBanks]   = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({
    received_date: new Date().toISOString().split('T')[0],
    received_bank_account_id: '',
    notes: '',
  });
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  useEffect(() => {
    api.get('/banks/accounts').then((r) => setBanks(r.data)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(`/invoices/${invoice.id}/receive`, form);
      toast('Invoice marked as Received', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Mark Received — #{invoice.invoice_number}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              <span className="text-muted">Amount: </span>
              <strong>{formatCurrency(invoice.total_amount, invoice.currency)}</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Received Into (Bank Account)</label>
              <select className="form-control" value={form.received_bank_account_id} onChange={f('received_bank_account_id')}>
                <option value="">— Cash / Not specified —</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.bank_name} · {b.account_title} ({b.currency})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date Received *</label>
              <input type="date" className="form-control" required value={form.received_date} onChange={f('received_date')}/>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={f('notes')}/>
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
function InvoiceDetail({ invoiceId, wings, onClose, onRefresh }) {
  const toast = useToast();
  const [inv, setInv]             = useState(null);
  const [receiveModal, setReceive] = useState(false);
  const [updating, setUpdating]   = useState(false);

  const load = useCallback(async () => {
    try { setInv((await api.get(`/invoices/${invoiceId}`)).data); }
    catch { toast('Failed to load invoice', 'error'); }
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.put(`/invoices/${invoiceId}`, { status });
      toast(`Status updated to ${status}`, 'success');
      load(); onRefresh();
    } catch { toast('Update failed', 'error'); }
    finally { setUpdating(false); }
  }

  if (!inv) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    </div>
  );

  const lineItems = Array.isArray(inv.line_items) ? inv.line_items
    : typeof inv.line_items === 'string' ? JSON.parse(inv.line_items || '[]')
    : [];
  const wing = wings.find((w) => w.id === inv.business_wing_id);

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 740 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Invoice #{inv.invoice_number}</h3>
            <div className="flex gap-2">
              <span className={`badge ${statusBadgeClass(inv.status)}`}>{inv.status}</span>
              <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
            </div>
          </div>

          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid-2" style={{ gap: 8 }}>
              {[
                ['Business Wing', wing?.name || '—'],
                ['Vendor',        inv.vendor_name || '—'],
                ['Client',        inv.client_name || '—'],
                ['Invoice Date',  formatDate(inv.invoice_date)],
                ['Due Date',      formatDate(inv.due_date) || '—'],
                ['Currency',      inv.currency],
                ['PO Reference',  inv.po_number || '—'],
                ['Received Date', inv.received_date ? formatDate(inv.received_date) : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            {lineItems.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Line Items</div>
                <table className="table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                  <tbody>
                    {lineItems.map((it, i) => (
                      <tr key={i}>
                        <td>
                          <div>{it.description}</div>
                          {it.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.notes}</div>}
                        </td>
                        <td className="font-mono">{it.quantity}</td>
                        <td className="font-mono">{formatCurrency(it.unit_price, inv.currency)}</td>
                        <td className="font-mono">{formatCurrency(it.amount, inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 280, background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['Subtotal',   formatCurrency(parseFloat(inv.total_amount) - parseFloat(inv.tax_amount || 0), inv.currency), false],
                  ['Tax',        formatCurrency(inv.tax_amount || 0, inv.currency), false],
                  ['Total',      formatCurrency(inv.total_amount, inv.currency), true],
                  inv.currency !== 'PKR' && ['PKR Equivalent', formatCurrency(inv.pkr_equivalent, 'PKR'), false],
                ].filter(Boolean).map(([label, value, bold]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid var(--border)' : 'none', paddingTop: bold ? 6 : 0 }}>
                    <span className="text-muted">{label}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {inv.status === 'Received' && inv.received_bank_name && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                <strong>Received into:</strong> {inv.received_bank_name} on {formatDate(inv.received_date)}
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
              {inv.status === 'Pending' && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('Overdue')}>Mark Overdue</button>
              )}
              {inv.status === 'Overdue' && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('Pending')}>Revert to Pending</button>
              )}
              {inv.status === 'Pending' && (
                <button className="btn btn-secondary btn-sm" disabled={updating} onClick={() => updateStatus('Disputed')}>Mark Disputed</button>
              )}
            </div>
            <div className="flex gap-2">
              {['Pending', 'Overdue'].includes(inv.status) && (
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
          invoice={inv}
          onClose={() => setReceive(false)}
          onSaved={() => { setReceive(false); load(); onRefresh(); }}
        />
      )}
    </>
  );
}

// ─── Invoice Form ─────────────────────────────────────────────────────────────
function InvoiceForm({ wings, prefill, onClose, onSaved }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [pos, setPos]       = useState([]);

  const defaultItems = prefill?.line_items?.length
    ? prefill.line_items
    : [{ ...EMPTY_ITEM }];

  const [items, setItems] = useState(defaultItems);
  const [form, setForm]   = useState({
    wing_id:        prefill?.wing_id        || '',
    vendor_name:    prefill?.vendor_name    || '',
    client_name:    prefill?.client_name    || '',
    invoice_number: prefill?.invoice_number || '',
    po_id:          '',
    po_number_ref:  prefill?.po_number_ref  || '',
    currency:       prefill?.currency       || 'PKR',
    exchange_rate:  prefill?.exchange_rate  || '1',
    invoice_date:   prefill?.invoice_date   || new Date().toISOString().split('T')[0],
    due_date:       prefill?.due_date       || '',
    tax_amount:     prefill?.tax_amount     || '0',
    notes:          prefill?.notes          || '',
  });

  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  useEffect(() => {
    if (form.wing_id) {
      api.get('/purchase-orders', { params: { wing_id: form.wing_id, status: 'Active' } })
        .then((r) => setPos(r.data)).catch(() => {});
    } else {
      setPos([]);
    }
  }, [form.wing_id]);

  function setItem(i, key, val) { setItems((p) => p.map((it, idx) => idx === i ? calcItem(it, key, val) : it)); }
  function addItem()    { setItems((p) => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(i) { setItems((p) => p.filter((_, idx) => idx !== i)); }

  const subtotal = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const taxAmt   = parseFloat(form.tax_amount) || 0;
  const total    = subtotal + taxAmt;

  async function submit(e) {
    e.preventDefault();
    if (!form.wing_id) { toast('Please select a Business Wing', 'error'); return; }
    setSaving(true);
    try {
      const line_items = items.map((it) => ({
        description: it.description,
        notes:       it.notes || '',
        quantity:    parseFloat(it.quantity) || 1,
        unit_price:  parseFloat(it.unit_price) || 0,
        amount:      parseFloat(it.amount) || 0,
      }));

      await api.post('/invoices', {
        wing_id:        form.wing_id,
        po_id:          form.po_id || null,
        invoice_number: form.invoice_number,
        vendor_name:    form.vendor_name,
        client_name:    form.client_name,
        invoice_date:   form.invoice_date,
        due_date:       form.due_date || null,
        currency:       form.currency,
        exchange_rate:  parseFloat(form.exchange_rate) || 1,
        total_amount:   total,
        tax_amount:     taxAmt,
        line_items,
        notes: form.notes || (form.po_number_ref ? `PO Ref: ${form.po_number_ref}` : ''),
      });
      toast('Invoice saved', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error saving invoice', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{prefill ? 'Review & Save Extracted Invoice' : 'New Invoice'}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {prefill && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>
                Fields extracted from your PDF — review and correct if needed, then select a Business Wing and save.
              </div>
            )}

            {/* ── Wing selector — top, prominent ── */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', border: '2px solid var(--navy)' }}>
              <label className="form-label" style={{ color: 'var(--navy)', fontWeight: 700, fontSize: 13 }}>
                Business Wing *
              </label>
              <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}
                style={{ marginTop: 6, fontWeight: 600 }}>
                <option value="">— Select Business Wing —</option>
                {wings.map((w) => <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ''}</option>)}
              </select>
              {wings.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>
                  No wings available. Please log out and log back in.
                </div>
              )}
            </div>

            {/* Vendor + Client */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Vendor (From)</label>
                <input className="form-control" placeholder="e.g. Raheem Solutions (Pvt.) Ltd."
                  value={form.vendor_name} onChange={f('vendor_name')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Client / Bill To</label>
                <input className="form-control" placeholder="e.g. MPDFM LTD"
                  value={form.client_name} onChange={f('client_name')}/>
              </div>
            </div>

            {/* Invoice # + PO link */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Invoice # *</label>
                <input className="form-control" required placeholder="e.g. 1223"
                  value={form.invoice_number} onChange={f('invoice_number')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Link to PO</label>
                {pos.length > 0 ? (
                  <select className="form-control" value={form.po_id} onChange={f('po_id')}>
                    <option value="">— None / Reference only —</option>
                    {pos.map((p) => (
                      <option key={p.id} value={p.id}>{p.po_number} — {formatCurrency(p.po_value, p.currency)}</option>
                    ))}
                  </select>
                ) : (
                  <input className="form-control" placeholder="PO / SO # reference (text)"
                    value={form.po_number_ref} onChange={f('po_number_ref')}/>
                )}
              </div>
            </div>

            {/* Dates */}
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

            {/* Currency + Tax */}
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-control" value={form.currency} onChange={f('currency')}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {form.currency !== 'PKR' && (
                <div className="form-group">
                  <label className="form-label">Exchange Rate → PKR</label>
                  <input type="number" step="0.0001" className="form-control"
                    value={form.exchange_rate} onChange={f('exchange_rate')}/>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Tax Amount</label>
                <input type="number" step="0.01" className="form-control"
                  placeholder="0" value={form.tax_amount} onChange={f('tax_amount')}/>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Line Items</div>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'start' }}>
                  <div>
                    <input className="form-control" placeholder="Description *" value={it.description}
                      onChange={(e) => setItem(i, 'description', e.target.value)}/>
                    <input className="form-control" placeholder="Notes (optional)" value={it.notes || ''}
                      style={{ marginTop: 4, fontSize: 12 }}
                      onChange={(e) => setItem(i, 'notes', e.target.value)}/>
                  </div>
                  <input type="number" step="0.001" className="form-control" placeholder="Qty"
                    value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)}/>
                  <input type="number" step="0.01" className="form-control" placeholder="Rate"
                    value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)}/>
                  <input type="number" step="0.01" className="form-control" placeholder="Amount"
                    value={it.amount} onChange={(e) => setItem(i, 'amount', e.target.value)}/>
                  <div style={{ fontSize: 13, padding: '8px 4px', fontWeight: 500, color: 'var(--navy)' }}>
                    {formatCurrency(parseFloat(it.amount) || 0, form.currency)}
                  </div>
                  {items.length > 1 && (
                    <button type="button" className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 8px', marginTop: 2 }}
                      onClick={() => removeItem(i)}><Trash2 size={13}/></button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                <Plus size={12}/> Add Line
              </button>
            </div>

            {/* Running totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 280, background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                {[
                  ['Subtotal', formatCurrency(subtotal, form.currency), false],
                  ['Tax',      formatCurrency(taxAmt,   form.currency), false],
                  ['Total',    formatCurrency(total,    form.currency), true],
                ].map(([label, value, bold]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid var(--border)' : 'none', paddingTop: bold ? 6 : 0, marginTop: bold ? 4 : 0 }}>
                    <span className="text-muted">{label}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')}/>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : prefill ? 'Save Invoice' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Invoices() {
  const { activeWing, wings } = useAuth();
  const toast                 = useToast();
  const fileInputRef          = useRef(null);

  const [invoices, setInvoices]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [extracting, setExtracting]     = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal]               = useState(null); // null | 'create' | invoiceId
  const [prefill, setPrefill]           = useState(null);

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

  async function handlePDFUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setExtracting(true);
    try {
      const text = await extractTextFromPDF(file);
      const extracted = parseInvoiceText(text);
      setPrefill(extracted);
      setModal('import');
    } catch (err) {
      console.error('PDF extraction error', err);
      toast('Could not read PDF. Please enter invoice details manually.', 'error');
      setPrefill(null);
      setModal('create');
    } finally {
      setExtracting(false);
    }
  }

  const totalPending = invoices.filter((i) => i.status === 'Pending').reduce((s, i) => s + parseFloat(i.pkr_equivalent || i.total_amount || 0), 0);
  const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;

  return (
    <div>
      {/* Hidden file input for PDF upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handlePDFUpload}
      />

      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          {invoices.length > 0 && (
            <div style={{ fontSize: 13, marginTop: 2, color: 'var(--text-muted)' }}>
              {invoices.length} invoices
              {totalPending > 0 && <> · Pending: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(totalPending, 'PKR')}</strong></>}
              {overdueCount > 0 && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>· {overdueCount} overdue</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            disabled={extracting}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15}/>
            {extracting ? ' Extracting…' : ' Import PDF Invoice'}
          </button>
          <button className="btn btn-primary" onClick={() => { setPrefill(null); setModal('create'); }}>
            <Plus size={15}/> New Invoice
          </button>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(s)}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th><th>Vendor</th><th>Client</th><th>Wing</th>
                <th>Date</th><th>Due</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>Loading…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>No invoices found</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setModal(inv.id)}>
                  <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td style={{ fontSize: 13 }}>{inv.vendor_name || <span className="text-muted">—</span>}</td>
                  <td style={{ fontSize: 13 }}>{inv.client_name || <span className="text-muted">—</span>}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{inv.wing_name}</td>
                  <td className="text-muted">{formatDate(inv.invoice_date)}</td>
                  <td className="text-muted">{formatDate(inv.due_date) || '—'}</td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {formatCurrency(inv.total_amount, inv.currency)}
                  </td>
                  <td><span className={`badge ${statusBadgeClass(inv.status)}`}>{inv.status}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal(inv.id)}><Eye size={13}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {(modal === 'create' || modal === 'import') && (
        <InvoiceForm
          wings={wings}
          prefill={prefill}
          onClose={() => { setModal(null); setPrefill(null); }}
          onSaved={() => { setModal(null); setPrefill(null); load(); }}
        />
      )}
      {modal && modal !== 'create' && modal !== 'import' && (
        <InvoiceDetail invoiceId={modal} wings={wings} onClose={() => setModal(null)} onRefresh={load}/>
      )}
    </div>
  );
}

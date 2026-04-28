import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, statusBadgeClass } from '../../lib/format';
import { X, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import InvoiceFileViewer from '../../components/InvoiceFileViewer';

const MODE_LABEL = { single: 'Single Wing', split: 'Split Between Wings', line_item: 'By Line Item' };

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
  const [updating, setUpdating]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);

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
              {inv.has_file && (
                <InvoiceFileViewer
                  invoiceId={invoiceId}
                  fileName={inv.source_file_name}
                  fileType={inv.source_file_type}
                  fileSize={inv.source_file_size}
                  trigger="button"
                />
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
    </>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { extractFromPDF } from '../../lib/pdfExtract';
import { formatCurrency, formatDate } from '../../lib/format';
import { Upload, Plus, Trash2, X, ChevronRight, ChevronLeft, Check, AlertTriangle, FileText } from 'lucide-react';

const CURRENCIES = ['PKR', 'USD', 'EUR', 'AED', 'GBP'];
const EMPTY_ITEM = { description: '', notes: '', quantity: 1, unit_price: '', amount: '', business_wing_id: '' };
const today = () => new Date().toISOString().split('T')[0];

function calcItem(item, key, val) {
  const next = { ...item, [key]: val };
  if (key === 'unit_price' || key === 'quantity')
    next.amount = (parseFloat(next.unit_price||0) * parseFloat(next.quantity||1)).toFixed(2);
  return next;
}

// ─── Searchable select ────────────────────────────────────────────────────────
function SearchSelect({ value, onChange, options, placeholder }) {
  const [query, setQuery]   = useState(value || '');
  const [open, setOpen]     = useState(false);
  const ref                 = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  function select(name) { onChange(name); setQuery(name); setOpen(false); }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="form-control"
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          maxHeight: 200, overflowY: 'auto', marginTop: 2,
        }}>
          {filtered.map(name => (
            <div
              key={name}
              onMouseDown={() => select(name)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                background: name === value ? 'var(--electric-light)' : undefined,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = name === value ? 'var(--electric-light)' : ''}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Stepper({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((label, i) => {
        const idx  = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: done ? 'var(--success)' : active ? 'var(--navy)' : 'var(--border)',
                color: done || active ? 'var(--white)' : 'var(--text-muted)',
              }}>
                {done ? <Check size={13}/> : idx}
              </div>
              <div style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? 'var(--navy)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ height: 1, flex: 0.5, background: done ? 'var(--success)' : 'var(--border)', marginBottom: 18 }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

function humanFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Step 1 — Upload ──────────────────────────────────────────────────────────
function StepUpload({ onExtracted, uploadedFile, setUploadedFile }) {
  const fileRef = useRef(null);
  const [drag, setDrag]         = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const toast = useToast();

  async function handle(file) {
    if (!file) return;
    const allowed = /\.(pdf|png|jpg|jpeg|webp|tiff?)$/i;
    if (!allowed.test(file.name)) {
      toast('Please upload a PDF or image file', 'error'); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast('File must be under 20 MB', 'error'); return;
    }

    setUploading(true);
    setProgress(0);

    // Run client-side extraction in parallel with server upload (best effort)
    const extractPromise = extractFromPDF(file).catch(() => ({}));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/invoices/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => {
          if (e.total) setProgress(Math.round(e.loaded / e.total * 100));
        },
      });

      const serverFields = response.data.parsed_fields || {};
      const clientData   = await extractPromise;

      // Merge: prefer server fields for scalars, client for line items
      const merged = {
        invoice_number: serverFields.invoice_number || clientData.invoice_number || '',
        vendor_name:    serverFields.vendor_name    || clientData.vendor_name    || '',
        client_name:    serverFields.client_name    || clientData.client_name    || '',
        invoice_date:   serverFields.invoice_date   || clientData.invoice_date   || '',
        due_date:       serverFields.due_date        || clientData.due_date       || '',
        currency:       serverFields.currency        || clientData.currency       || 'PKR',
        tax_amount:     serverFields.tax_amount      || clientData.tax_amount     || '0',
        notes:          serverFields.notes           || clientData.notes          || '',
        line_items:     clientData.line_items?.length ? clientData.line_items : [],
      };

      setUploadedFile({
        temp_file_path: response.data.temp_file_path,
        file_name:      response.data.file_name,
        file_size:      response.data.file_size,
        file_type:      response.data.file_type,
      });

      onExtracted(merged);
    } catch (err) {
      toast(err.response?.data?.error || 'Upload failed — try again', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '20px 0' }}>
      <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff" style={{ display:'none' }} onChange={e => { if (e.target.files[0]) handle(e.target.files[0]); }}/>

      {/* File badge if already uploaded */}
      {uploadedFile && !uploading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--success-light)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '10px 14px', width: '100%', maxWidth: 480 }}>
            <FileText size={16} color="var(--success)"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {uploadedFile.file_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {humanFileSize(uploadedFile.file_size)} · Parsed ✓
                {uploadedFile.temp_file_path ? ' · Stored in bucket ✓' : ''}
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => { setUploadedFile(null); fileRef.current?.click(); }}
            >
              Replace
            </button>
          </div>
          {!uploadedFile.temp_file_path && (
            <div style={{ width: '100%', maxWidth: 480, background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
              ⚠ File could not be stored in Supabase (bucket may not exist). The invoice data will still be imported but no file will be attached. Create the <strong>invoice-documents</strong> bucket in Supabase Storage to enable file attachment.
            </div>
          )}
        </>
      )}

      {!uploadedFile && (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          style={{
            width: '100%', maxWidth: 480, minHeight: 200,
            border: `2px dashed ${drag ? 'var(--navy)' : 'var(--border)'}`,
            borderRadius: 12, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            cursor: uploading ? 'default' : 'pointer',
            background: drag ? 'var(--electric-light)' : 'var(--bg)',
            transition: 'all .15s',
          }}
        >
          {uploading ? (
            <div style={{ width: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Uploading and reading invoice…</div>
              <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--navy)', borderRadius: 4, transition: 'width .15s' }}/>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{progress}%</div>
            </div>
          ) : (
            <>
              <Upload size={36} color="var(--navy)" strokeWidth={1.5}/>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop invoice here or click to browse</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, PNG, JPG, WEBP · Max 20 MB</div>
              </div>
              <button className="btn btn-primary" type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                <Upload size={14}/> Choose File
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Review Fields ───────────────────────────────────────────────────
function StepReview({ form, setForm, lineItems, setLineItems, clients }) {
  const subtotal = lineItems.reduce((s, i) => s + parseFloat(i.amount||0), 0);
  const taxAmt   = parseFloat(form.tax_amount||0);
  const total    = subtotal + taxAmt;

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }
  function setItem(i, key, val) { setLineItems(p => p.map((it, idx) => idx === i ? calcItem(it, key, val) : it)); }
  function addItem()    { setLineItems(p => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(i) { setLineItems(p => p.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Invoice # *</label>
          <input className="form-control" required value={form.invoice_number} onChange={f('invoice_number')} placeholder="e.g. 1223"/>
        </div>
        <div className="form-group">
          <label className="form-label">Client</label>
          <SearchSelect
            value={form.vendor_name}
            onChange={v => setForm(p => ({ ...p, vendor_name: v }))}
            options={(clients||[]).map(c => c.name)}
            placeholder="Select or type client name"
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Bill To</label>
        <SearchSelect
          value={form.client_name}
          onChange={v => setForm(p => ({ ...p, client_name: v }))}
          options={(clients||[]).map(c => c.name)}
          placeholder="Select or type bill-to name"
        />
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
          <select className="form-control" value={form.tax_rate || ''} onChange={e => {
            const rate = e.target.value;
            const computed = rate ? (subtotal * parseFloat(rate) / 100).toFixed(2) : form.tax_amount;
            setForm(p => ({ ...p, tax_rate: rate, tax_amount: computed }));
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

      {/* Line items */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Line Items</div>
        {lineItems.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'start' }}>
            <div>
              <input className="form-control" placeholder="Description *" value={it.description} onChange={e => setItem(i, 'description', e.target.value)}/>
              <input className="form-control" placeholder="Notes (optional)" value={it.notes||''} style={{ marginTop: 4, fontSize: 12 }} onChange={e => setItem(i, 'notes', e.target.value)}/>
            </div>
            <input type="number" step="0.001" className="form-control" placeholder="Qty" value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)}/>
            <input type="number" step="0.01" className="form-control" placeholder="Rate" value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)}/>
            <input type="number" step="0.01" className="form-control" placeholder="Amount" value={it.amount} onChange={e => setItem(i, 'amount', e.target.value)}/>
            {lineItems.length > 1
              ? <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px 8px' }} onClick={() => removeItem(i)}><Trash2 size={12}/></button>
              : <div/>
            }
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={12}/> Add Line</button>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ minWidth: 260, background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
          {[['Subtotal', subtotal, false], ['Tax', taxAmt, false], ['Total', total, true]].map(([l,v,b]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', fontWeight: b?700:400, borderTop: b?'1px solid var(--border)':'none', paddingTop: b?6:0, marginTop: b?4:0 }}>
              <span className="text-muted">{l}</span>
              <span className="font-mono">{formatCurrency(v, form.currency)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')}/>
      </div>
    </div>
  );
}

// ─── Step 3 — Link PO ─────────────────────────────────────────────────────────
function StepPO({ form, totalAmount, currency, exchRate, selectedPO, setSelectedPO }) {
  const { activeWing } = useAuth();
  const [query, setQuery]   = useState('');
  const [allPos, setAllPos] = useState([]);
  const [invoiced, setInvoiced] = useState(0);

  useEffect(() => {
    const params = { exclude_expired: true };
    if (activeWing?.id) params.wing_id = activeWing.id;
    api.get('/purchase-orders', { params }).then(r => setAllPos(r.data)).catch(() => {});
  }, [activeWing?.id]);

  useEffect(() => {
    if (!selectedPO) { setInvoiced(0); return; }
    api.get('/invoices', { params: { po_id: selectedPO.id } })
      .then(r => {
        const sum = r.data.reduce((s, inv) => s + parseFloat(inv.total_amount||0), 0);
        setInvoiced(sum);
      }).catch(() => {});
  }, [selectedPO]);

  const filtered = query.trim()
    ? allPos.filter(p => p.po_number?.toLowerCase().includes(query.toLowerCase()) || p.client_name?.toLowerCase().includes(query.toLowerCase()))
    : allPos.slice(0, 12);

  const poTotal    = parseFloat(selectedPO?.po_value || 0);
  const remaining  = poTotal - invoiced;
  const afterThis  = remaining - totalAmount;
  const overBudget = afterThis < 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <label className="form-label">Search Purchase Order (optional)</label>
        <input className="form-control" placeholder="Type PO number or client name…" value={query} onChange={e => setQuery(e.target.value)}/>
      </div>

      {!selectedPO && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
          {filtered.map(po => (
            <div key={po.id}
              onClick={() => { setSelectedPO(po); setQuery(''); }}
              style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>PO #{po.po_number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{po.client_name || '—'}</div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{formatCurrency(po.po_value, po.currency)}</div>
            </div>
          ))}
        </div>
      )}

      {selectedPO && (
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>PO #{selectedPO.po_number}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedPO.client_name}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPO(null)}><X size={12}/> Clear</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            {[
              ['PO Total',               formatCurrency(poTotal,    selectedPO.currency)],
              ['Already Invoiced',       formatCurrency(invoiced,   selectedPO.currency)],
              ['Remaining (before)',     formatCurrency(remaining,  selectedPO.currency)],
              ['This Invoice',           formatCurrency(totalAmount, currency)],
              ['Remaining (after)',      formatCurrency(Math.abs(afterThis), selectedPO.currency)],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--surface)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          {overBudget && (
            <div style={{ marginTop: 10, background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={16} color="var(--warning-text)"/>
              <span>This invoice exceeds the remaining PO balance by <strong>{formatCurrency(Math.abs(afterThis), selectedPO.currency)}</strong>. You can still proceed.</span>
            </div>
          )}
        </div>
      )}

      {!selectedPO && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
          No PO linked — invoice will be saved without a purchase order reference.
        </div>
      )}
    </div>
  );
}

// ─── Step 4 — Wing Assignment ─────────────────────────────────────────────────
function StepWings({ wings, totalAmount, currency, exchRate, wingMode, setWingMode, singleWingId, setSingleWingId, wingSplits, setWingSplits, lineItems, setLineItems }) {
  const autoSingle = wings.length === 1;
  const cur         = parseFloat(totalAmount) || 0;
  const exr         = parseFloat(exchRate) || 1;

  // Split mode helpers
  function updateSplit(id, field, val) {
    setWingSplits(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = { ...s, [field]: val };
      if (field === 'pct') {
        next.amount = cur > 0 ? (parseFloat(val||0) / 100 * cur).toFixed(2) : '';
      } else if (field === 'amount') {
        next.pct = cur > 0 ? (parseFloat(val||0) / cur * 100).toFixed(2) : '';
      }
      return next;
    }));
  }
  function addSplitRow() { setWingSplits(p => [...p, { id: Date.now(), wing_id: '', pct: '', amount: '' }]); }
  function removeSplitRow(id) { setWingSplits(p => p.filter(s => s.id !== id)); }

  function autoDistribute() {
    const unfilled = wingSplits.filter(s => s.wing_id && !s.pct && !s.amount);
    if (!unfilled.length) return;
    const used = wingSplits.filter(s => s.wing_id && s.amount).reduce((sum, s) => sum + parseFloat(s.amount||0), 0);
    const remaining = cur - used;
    const share = (remaining / unfilled.length).toFixed(2);
    setWingSplits(prev => prev.map(s => {
      if (!unfilled.find(u => u.id === s.id)) return s;
      return { ...s, amount: share, pct: cur > 0 ? (parseFloat(share)/cur*100).toFixed(2) : '' };
    }));
  }

  const splitTotal = wingSplits.reduce((sum, s) => sum + parseFloat(s.amount||0), 0);
  const splitRemaining = cur - splitTotal;
  const splitValid = Math.abs(splitRemaining) < 0.02;

  // Line item wing summary
  const wingTotals = {};
  for (const item of lineItems) {
    if (!item.business_wing_id) continue;
    wingTotals[item.business_wing_id] = (wingTotals[item.business_wing_id]||0) + parseFloat(item.amount||0);
  }
  const unassignedItems = lineItems.filter(i => parseFloat(i.amount||0) > 0 && !i.business_wing_id);

  const modeCard = (mode, title, desc, icon) => {
    const selected = wingMode === mode;
    return (
      <div
        onClick={() => setWingMode(mode)}
        style={{
          padding: '14px 18px', borderRadius: 10, cursor: 'pointer',
          border: `2px solid ${selected ? 'var(--navy)' : 'var(--border)'}`,
          background: selected ? 'var(--electric-light)' : 'var(--surface)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? 'var(--navy)' : 'var(--border)'}`, background: selected ? 'var(--navy)' : 'none', marginTop: 2, flexShrink: 0 }}/>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: selected ? 'var(--navy)' : 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {autoSingle && (
        <div style={{ background: 'var(--success-light)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          Auto-assigned to <strong>{wings[0].name}</strong> based on your access.
        </div>
      )}

      {!autoSingle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>How do you want to assign this invoice?</div>
          {modeCard('single', 'Single Wing', 'Entire invoice belongs to one business wing')}
          {modeCard('split',  'Split Between Wings', 'Divide invoice total across multiple wings by percentage or amount')}
          {modeCard('line_item', 'By Line Item', 'Assign each service / line item to a different wing')}
        </div>
      )}

      {/* ── Single ── */}
      {wingMode === 'single' && !autoSingle && (
        <div className="form-group">
          <label className="form-label">Select Business Wing *</label>
          <select className="form-control" value={singleWingId} onChange={e => setSingleWingId(e.target.value)}>
            <option value="">— Select Wing —</option>
            {wings.map(w => <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ''}</option>)}
          </select>
        </div>
      )}

      {/* ── Split ── */}
      {wingMode === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr auto', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '0 4px' }}>
            <span>Wing</span><span>Split %</span><span>Amount ({currency})</span><span>PKR Equiv</span><span/>
          </div>
          {wingSplits.map(s => {
            const pkr = parseFloat(s.amount||0) * (currency === 'PKR' ? 1 : exr);
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr auto', gap: 6, alignItems: 'center' }}>
                <select className="form-control" value={s.wing_id} onChange={e => updateSplit(s.id, 'wing_id', e.target.value)}>
                  <option value="">— Wing —</option>
                  {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input type="number" step="0.01" className="form-control" placeholder="%" value={s.pct} onChange={e => updateSplit(s.id, 'pct', e.target.value)}/>
                <input type="number" step="0.01" className="form-control" placeholder="Amount" value={s.amount} onChange={e => updateSplit(s.id, 'amount', e.target.value)}/>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', padding: '8px 4px' }}>{currency !== 'PKR' ? formatCurrency(pkr, 'PKR') : '—'}</div>
                {wingSplits.length > 2
                  ? <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px 8px' }} onClick={() => removeSplitRow(s.id)}><Trash2 size={12}/></button>
                  : <div/>
                }
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addSplitRow}><Plus size={12}/> Add Wing</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={autoDistribute}>Auto-distribute remaining</button>
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <span className="text-muted">Total allocated</span>
            <strong>{formatCurrency(splitTotal, currency)}</strong>
            <span className="text-muted">Remaining</span>
            <strong style={{ color: splitValid ? 'var(--success)' : 'var(--danger)' }}>
              {formatCurrency(Math.abs(splitRemaining), currency)}
              {splitValid ? ' ✓' : ''}
            </strong>
          </div>
          {!splitValid && <div style={{ fontSize: 12, color: 'var(--danger)' }}>Allocations must sum exactly to {formatCurrency(cur, currency)}</div>}
        </div>
      )}

      {/* ── By Line Item ── */}
      {wingMode === 'line_item' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Assign each line item to a wing</div>
          {lineItems.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: 8, alignItems: 'center', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{it.description || <em className="text-muted">No description</em>}</div>
                {it.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.notes}</div>}
              </div>
              <div className="font-mono" style={{ fontSize: 13 }}>×{it.quantity}</div>
              <div className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(parseFloat(it.amount)||0, currency)}</div>
              {parseFloat(it.amount||0) > 0 ? (
                <select
                  className="form-control"
                  style={{ border: it.business_wing_id ? '1px solid var(--border)' : '1px solid var(--danger)' }}
                  value={it.business_wing_id || ''}
                  onChange={e => setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, business_wing_id: e.target.value } : li))}
                >
                  <option value="">— Wing required —</option>
                  {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Zero value — skipped</span>
              )}
            </div>
          ))}

          {/* Wing summary table */}
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Wing Summary</div>
            <table className="table" style={{ fontSize: 13 }}>
              <thead><tr><th>Wing</th><th style={{ textAlign:'right' }}>Amount</th><th style={{ textAlign:'right' }}>%</th></tr></thead>
              <tbody>
                {Object.entries(wingTotals).map(([wid, amt]) => {
                  const wing = wings.find(w => w.id === wid);
                  return (
                    <tr key={wid}>
                      <td>{wing?.name || wid}</td>
                      <td className="font-mono" style={{ textAlign:'right' }}>{formatCurrency(amt, currency)}</td>
                      <td className="font-mono" style={{ textAlign:'right' }}>{cur > 0 ? (amt/cur*100).toFixed(1) : 0}%</td>
                    </tr>
                  );
                })}
                {unassignedItems.length > 0 && (
                  <tr><td style={{ color:'var(--danger)' }}>⚠ Unassigned ({unassignedItems.length} items)</td><td className="font-mono" style={{ textAlign:'right', color:'var(--danger)' }}>{formatCurrency(unassignedItems.reduce((s,i)=>s+parseFloat(i.amount||0),0), currency)}</td><td/></tr>
                )}
                <tr style={{ fontWeight:700, borderTop:'2px solid var(--border)' }}>
                  <td>TOTAL</td>
                  <td className="font-mono" style={{ textAlign:'right' }}>{formatCurrency(cur, currency)}</td>
                  <td className="font-mono" style={{ textAlign:'right' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          {unassignedItems.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>All line items must be assigned to a wing before proceeding.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 5 — Confirm ─────────────────────────────────────────────────────────
function StepConfirm({ form, lineItems, selectedPO, wings, wingMode, singleWingId, wingSplits, autoSingleWing, uploadedFile }) {
  const subtotal = lineItems.reduce((s, i) => s + parseFloat(i.amount||0), 0);
  const taxAmt   = parseFloat(form.tax_amount||0);
  const total    = subtotal + taxAmt;
  const exr      = parseFloat(form.exchange_rate||1);
  const pkr      = form.currency === 'PKR' ? total : total * exr;

  const getWingBreakdown = () => {
    if (wingMode === 'single' || autoSingleWing) {
      const w = wings.find(w => w.id === (autoSingleWing?.id || singleWingId));
      return w ? [{ name: w.name, amount: total, pct: 100 }] : [];
    }
    if (wingMode === 'split') {
      return wingSplits.filter(s => s.wing_id).map(s => {
        const w = wings.find(w => w.id === s.wing_id);
        return { name: w?.name || s.wing_id, amount: parseFloat(s.amount||0), pct: parseFloat(s.pct||0) };
      });
    }
    if (wingMode === 'line_item') {
      const totals = {};
      for (const item of lineItems) {
        if (!item.business_wing_id) continue;
        totals[item.business_wing_id] = (totals[item.business_wing_id]||0) + parseFloat(item.amount||0);
      }
      return Object.entries(totals).map(([wid, amt]) => {
        const w = wings.find(w => w.id === wid);
        return { name: w?.name || wid, amount: amt, pct: total > 0 ? amt/total*100 : 0 };
      });
    }
    return [];
  };

  const breakdown = getWingBreakdown();
  const modeLabel = { single: 'Single Wing', split: 'Split Between Wings', line_item: 'By Line Item' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--navy)' }}>Invoice Summary</div>
        <div className="grid-2" style={{ gap: 8, marginBottom: 14 }}>
          {[
            ['Invoice #',    form.invoice_number],
            ['Vendor',       form.vendor_name || '—'],
            ['Client',       form.client_name || '—'],
            ['Invoice Date', formatDate(form.invoice_date)],
            ['Due Date',     form.due_date ? formatDate(form.due_date) : '—'],
            ['Currency',     form.currency],
            ['Total',        formatCurrency(total, form.currency)],
            ['PKR Equiv',    form.currency !== 'PKR' ? formatCurrency(pkr, 'PKR') : '—'],
            ['Linked PO',    selectedPO ? `PO #${selectedPO.po_number}` : 'None'],
            ['Tax',          formatCurrency(taxAmt, form.currency)],
            ['File Attached', uploadedFile?.temp_file_path ? `${uploadedFile.file_name}` : 'None'],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--surface)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
              <div style={{ fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
            Wing Assignment: {modeLabel[wingMode] || '—'}
          </div>
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th>Wing</th><th style={{ textAlign:'right' }}>Amount</th><th style={{ textAlign:'right' }}>%</th></tr></thead>
            <tbody>
              {breakdown.map(row => (
                <tr key={row.name}>
                  <td style={{ fontWeight: 500 }}>{row.name}</td>
                  <td className="font-mono" style={{ textAlign:'right' }}>{formatCurrency(row.amount, form.currency)}</td>
                  <td className="font-mono" style={{ textAlign:'right' }}>{row.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function InvoiceWizard({ wings, mode = 'import', onClose, onSaved }) {
  const toast = useToast();
  const { activeWing } = useAuth();

  const autoSingleWing = wings.length === 1 ? wings[0] : null;
  const startStep = mode === 'import' ? 1 : 2;

  const STEP_LABELS = mode === 'import'
    ? ['Upload', 'Review Fields', 'Link PO', 'Assign Wings', 'Confirm']
    : ['Review Fields', 'Link PO', 'Assign Wings', 'Confirm'];
  const STEP_NUMS = mode === 'import' ? [1,2,3,4,5] : [2,3,4,5];

  const [step, setStep]     = useState(startStep);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const params = {};
    if (activeWing?.id) params.wing_id = activeWing.id;
    api.get('/clients', { params }).then(r => setClients(r.data)).catch(() => {});
  }, [activeWing?.id]);

  // Step 1 state (file upload)
  const [uploadedFile, setUploadedFile] = useState(null); // { temp_file_path, file_name, file_size, file_type }

  // Step 2 state
  const [form, setForm] = useState({
    invoice_number: '', vendor_name: '', client_name: '',
    invoice_date: today(), due_date: '', currency: 'PKR', exchange_rate: '1',
    tax_rate: '', tax_amount: '0', notes: '',
  });
  const [lineItems, setLineItems] = useState([{ ...EMPTY_ITEM }]);

  // Step 3 state
  const [selectedPO, setSelectedPO] = useState(null);

  // Step 4 state
  const [wingMode, setWingMode]       = useState(autoSingleWing ? 'single' : null);
  const [singleWingId, setSingleWingId] = useState(autoSingleWing?.id || '');
  const [wingSplits, setWingSplits]   = useState([
    { id: 1, wing_id: '', pct: '', amount: '' },
    { id: 2, wing_id: '', pct: '', amount: '' },
  ]);

  const subtotal    = lineItems.reduce((s, i) => s + parseFloat(i.amount||0), 0);
  const taxAmt      = parseFloat(form.tax_amount||0);
  const totalAmount = subtotal + taxAmt;
  const exchRate    = parseFloat(form.exchange_rate||1);

  function onExtracted(data) {
    const items = data.line_items?.length
      ? data.line_items.map(i => ({ ...EMPTY_ITEM, ...i, business_wing_id: '' }))
      : [{ ...EMPTY_ITEM }];

    const taxAmount  = parseFloat(data.tax_amount || 0);
    const subtotal   = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const KNOWN_RATES = [0, 5, 10, 15, 16, 17, 20];
    let inferredRate = data.tax_rate ? String(data.tax_rate) : '';
    if (!inferredRate && taxAmount > 0 && subtotal > 0) {
      const pct = taxAmount / subtotal * 100;
      const match = KNOWN_RATES.find(r => Math.abs(r - pct) < 0.5);
      if (match !== undefined) inferredRate = String(match);
    }

    setForm({
      invoice_number: data.invoice_number || '',
      vendor_name:    data.vendor_name    || '',
      client_name:    data.client_name    || '',
      invoice_date:   data.invoice_date   || today(),
      due_date:       data.due_date       || data.payment_date || '',
      currency:       data.currency       || 'PKR',
      exchange_rate:  '1',
      tax_rate:       inferredRate,
      tax_amount:     data.tax_amount     || '0',
      notes:          data.notes          || '',
    });
    setLineItems(items);
    setStep(2);
  }

  function canProceed() {
    if (step === 1) return !!uploadedFile;
    if (step === 2) return form.invoice_number && form.invoice_date;
    if (step === 4) {
      if (!wingMode) return false;
      if (wingMode === 'single' && !autoSingleWing && !singleWingId) return false;
      if (wingMode === 'split') {
        const sumPct = wingSplits.reduce((s, w) => s + parseFloat(w.pct||0), 0);
        return Math.abs(sumPct - 100) < 0.05 && wingSplits.every(s => s.wing_id);
      }
      if (wingMode === 'line_item') {
        const unassigned = lineItems.filter(i => parseFloat(i.amount||0) > 0 && !i.business_wing_id);
        return unassigned.length === 0;
      }
    }
    return true;
  }

  async function save() {
    setSaving(true);
    try {
      const line_items = lineItems.map(i => ({
        description:      i.description,
        notes:            i.notes || '',
        quantity:         parseFloat(i.quantity) || 1,
        unit_price:       parseFloat(i.unit_price) || 0,
        amount:           parseFloat(i.amount) || 0,
        business_wing_id: i.business_wing_id || null,
      }));

      const wid = autoSingleWing ? autoSingleWing.id : singleWingId;
      const body = {
        wing_assignment_mode: wingMode || 'single',
        wing_id:    wingMode === 'single' || autoSingleWing ? wid : undefined,
        wing_splits: wingMode === 'split' ? wingSplits.filter(s => s.wing_id).map(s => ({
          business_wing_id: s.wing_id,
          split_percentage: parseFloat(s.pct),
          split_amount:     parseFloat(s.amount),
        })) : [],
        invoice_number: form.invoice_number,
        vendor_name:    form.vendor_name,
        client_name:    form.client_name,
        invoice_date:   form.invoice_date,
        due_date:       form.due_date || null,
        currency:       form.currency,
        exchange_rate:  exchRate,
        total_amount:   totalAmount,
        tax_amount:     taxAmt,
        line_items,
        po_id:          selectedPO?.id || null,
        notes:          form.notes || null,
        // file storage
        temp_file_path: uploadedFile?.temp_file_path || null,
        file_name:      uploadedFile?.file_name      || null,
        file_size:      uploadedFile?.file_size      || null,
        file_type:      uploadedFile?.file_type      || null,
      };

      await api.post('/invoices', body);
      toast('Invoice saved successfully', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Error saving invoice', 'error');
    } finally {
      setSaving(false);
    }
  }

  const stepContent = {
    1: <StepUpload onExtracted={onExtracted} uploadedFile={uploadedFile} setUploadedFile={setUploadedFile}/>,
    2: <StepReview form={form} setForm={setForm} lineItems={lineItems} setLineItems={setLineItems} clients={clients}/>,
    3: <StepPO form={form} totalAmount={totalAmount} currency={form.currency} exchRate={exchRate} selectedPO={selectedPO} setSelectedPO={setSelectedPO}/>,
    4: <StepWings wings={wings} totalAmount={totalAmount} currency={form.currency} exchRate={exchRate} wingMode={wingMode} setWingMode={setWingMode} singleWingId={singleWingId} setSingleWingId={setSingleWingId} wingSplits={wingSplits} setWingSplits={setWingSplits} lineItems={lineItems} setLineItems={setLineItems}/>,
    5: <StepConfirm form={form} lineItems={lineItems} selectedPO={selectedPO} wings={wings} wingMode={wingMode} singleWingId={singleWingId} wingSplits={wingSplits} autoSingleWing={autoSingleWing} uploadedFile={uploadedFile}/>,
  };

  const stepperStep = mode === 'import' ? step : step - 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'import' ? 'Import Invoice' : 'New Invoice'}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14}/></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Stepper steps={STEP_LABELS} current={stepperStep}/>
          <div style={{ flex: 1 }}>
            {stepContent[step]}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {step > startStep && (
              <button type="button" className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft size={14}/> Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {step < 5 && (step !== 1 || uploadedFile) && (
              <button type="button" className="btn btn-primary" disabled={!canProceed()} onClick={() => setStep(s => s + 1)}>
                Next <ChevronRight size={14}/>
              </button>
            )}
            {step === 5 && (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : <><Check size={14}/> Save Invoice</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

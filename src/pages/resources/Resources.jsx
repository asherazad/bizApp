import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Upload, Plus, Trash2, X, UserCheck, Package } from 'lucide-react';

function fmt(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toLocaleString('en-PK');
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{value || '—'}</div>
    </div>
  );
}

const EMPTY_FORM = {
  full_name: '', designation: '', cnic: '', account_number: '',
  bank_name: '', mode_of_transfer: '', job_type: '', employment_status: '',
  join_date: '', gross_salary: '', tax_amount: '', net_salary: '',
  business_wing_id: '', last_review_date: '', last_increment_amount: '', allowance_amount: '',
};

// ─── Shared resource form fields ──────────────────────────────────────────────
function ResourceFormFields({ form, onChange, wings }) {
  function f(k) { return e => onChange(k, e.target.value); }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="form-group">
        <label className="form-label">Full Name *</label>
        <input className="form-control" required value={form.full_name} onChange={f('full_name')} />
      </div>
      <div className="form-group">
        <label className="form-label">Wing</label>
        <select className="form-control" value={form.business_wing_id} onChange={f('business_wing_id')}>
          <option value="">None</option>
          {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Designation</label>
        <input className="form-control" value={form.designation} onChange={f('designation')} />
      </div>
      <div className="form-group">
        <label className="form-label">CNIC</label>
        <input className="form-control" placeholder="12345-6789012-3" value={form.cnic} onChange={f('cnic')} />
      </div>
      <div className="form-group">
        <label className="form-label">Account Number</label>
        <input className="form-control" value={form.account_number} onChange={f('account_number')} />
      </div>
      <div className="form-group">
        <label className="form-label">Bank Name</label>
        <input className="form-control" value={form.bank_name} onChange={f('bank_name')} />
      </div>
      <div className="form-group">
        <label className="form-label">Mode of Transfer</label>
        <select className="form-control" value={form.mode_of_transfer} onChange={f('mode_of_transfer')}>
          <option value="">Select…</option>
          {['Bank Transfer', 'Cash', 'Cheque'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Job Type</label>
        <select className="form-control" value={form.job_type} onChange={f('job_type')}>
          <option value="">Select…</option>
          {['On-Site', 'Remote', 'Out Source', 'Part time'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Employment Status</label>
        <select className="form-control" value={form.employment_status} onChange={f('employment_status')}>
          <option value="">Select…</option>
          {['Permanent', 'Probation', '3rd party', 'Hybrid', 'Part time'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Join Date</label>
        <input type="date" className="form-control" value={form.join_date} onChange={f('join_date')} />
      </div>
      <div className="form-group">
        <label className="form-label">Gross Salary (PKR)</label>
        <input type="number" className="form-control" value={form.gross_salary} onChange={f('gross_salary')} />
      </div>
      <div className="form-group">
        <label className="form-label">Allowance Amount (PKR)</label>
        <input type="number" className="form-control" value={form.allowance_amount || ''} onChange={f('allowance_amount')} placeholder="Added to gross in payroll" />
      </div>
      <div className="form-group">
        <label className="form-label">Tax Amount (PKR)</label>
        <input type="number" className="form-control" value={form.tax_amount} onChange={f('tax_amount')} />
      </div>
      <div className="form-group">
        <label className="form-label">Net Salary (PKR)</label>
        <input type="number" className="form-control" value={form.net_salary} onChange={f('net_salary')} />
      </div>
      <div className="form-group">
        <label className="form-label">Last Review Date</label>
        <input type="date" className="form-control" value={form.last_review_date || ''} onChange={f('last_review_date')} />
      </div>
      <div className="form-group">
        <label className="form-label">Last Increment Amount (PKR)</label>
        <input type="number" className="form-control" value={form.last_increment_amount || ''} onChange={f('last_increment_amount')} />
      </div>
    </div>
  );
}

// ─── Add Resource modal ───────────────────────────────────────────────────────
function AddModal({ wings, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  function onChange(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/resources', {
        ...form,
        business_wing_id:      form.business_wing_id      || null,
        gross_salary:          parseFloat(form.gross_salary)          || 0,
        allowance_amount:      parseFloat(form.allowance_amount)      || 0,
        tax_amount:            parseFloat(form.tax_amount)            || 0,
        net_salary:            parseFloat(form.net_salary)            || 0,
        last_review_date:      form.last_review_date      || null,
        last_increment_amount: parseFloat(form.last_increment_amount) || 0,
      });
      toast('Resource created', 'success');
      onSaved();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Error';
      toast(msg, 'error');
    }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 620, width: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Add Resource</h3>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <form onSubmit={submit} style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          <ResourceFormFields form={form} onChange={onChange} wings={wings} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Resource'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inventory panel ──────────────────────────────────────────────────────────
function InventoryPanel({ resourceId, toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ item_name: '', serial_number: '', assigned_date: today, notes: '' });

  async function load() {
    setLoading(true);
    try { setItems((await api.get(`/resources/${resourceId}/inventory`)).data); }
    catch { toast('Failed to load inventory', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [resourceId]);

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function addItem(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/resources/${resourceId}/inventory`, form);
      setForm({ item_name: '', serial_number: '', assigned_date: today, notes: '' });
      setAdding(false);
      load();
      toast('Item added', 'success');
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  async function del(itemId) {
    if (!confirm('Delete this inventory item?')) return;
    try {
      await api.delete(`/resources/${resourceId}/inventory/${itemId}`);
      load();
      toast('Deleted', 'success');
    } catch { toast('Error', 'error'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Package size={14} /> Assigned Inventory
        </h4>
        <button className="btn btn-secondary btn-sm" onClick={() => setAdding(v => !v)}>
          <Plus size={12} /> Add Item
        </button>
      </div>

      {adding && (
        <form onSubmit={addItem} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Item Name *</label>
              <input className="form-control" required value={form.item_name} onChange={f('item_name')} placeholder="e.g. Laptop" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Serial Number</label>
              <input className="form-control" value={form.serial_number} onChange={f('serial_number')} placeholder="SN-0001" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Assigned Date</label>
              <input type="date" className="form-control" value={form.assigned_date} onChange={f('assigned_date')} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Notes</label>
              <input className="form-control" value={form.notes} onChange={f('notes')} placeholder="Optional" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      {loading
        ? <p className="text-muted" style={{ fontSize: 13 }}>Loading…</p>
        : items.length === 0
          ? <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: '10px 0' }}>No inventory items assigned</p>
          : (
            <div className="table-wrap">
              <table className="table" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Item</th><th>Serial</th><th>Assigned</th><th>Notes</th><th style={{ width: 36 }}></th></tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.item_name}</td>
                      <td className="text-muted font-mono">{item.serial_number || '—'}</td>
                      <td className="text-muted">{formatDate(item.assigned_date)}</td>
                      <td className="text-muted">{item.notes || '—'}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => del(item.id)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}

// ─── Detail / Edit modal ──────────────────────────────────────────────────────
function DetailModal({ resource, wings, onClose, onSaved, toast }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ ...resource, join_date: (resource.join_date || '').slice(0, 10) });
  const [saving, setSaving]   = useState(false);

  function onChange(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/resources/${resource.id}`, {
        ...form,
        business_wing_id:      form.business_wing_id      || null,
        gross_salary:          parseFloat(form.gross_salary)          || 0,
        allowance_amount:      parseFloat(form.allowance_amount)      || 0,
        tax_amount:            parseFloat(form.tax_amount)            || 0,
        net_salary:            parseFloat(form.net_salary)            || 0,
        last_review_date:      form.last_review_date      || null,
        last_increment_amount: parseFloat(form.last_increment_amount) || 0,
      });
      toast('Saved', 'success');
      setEditing(false);
      onSaved();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Error';
      toast(msg, 'error');
    }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 700, width: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>{resource.full_name}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {[resource.designation, resource.wing_name].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(v => !v)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          {editing ? (
            <form onSubmit={save}>
              <ResourceFormFields form={form} onChange={onChange} wings={wings} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px', marginBottom: 20 }}>
                <Field label="Resource ID" value={resource.resource_seq_id} />
                <Field label="Wing" value={resource.wing_name} />
                <Field label="Designation" value={resource.designation} />
                <Field label="CNIC" value={resource.cnic} />
                <Field label="Account Number" value={resource.account_number} />
                <Field label="Bank Name" value={resource.bank_name} />
                <Field label="Mode of Transfer" value={resource.mode_of_transfer} />
                <Field label="Job Type" value={resource.job_type} />
                <Field label="Employment Status" value={resource.employment_status} />
                <Field label="Join Date" value={formatDate(resource.join_date)} />
                <Field label="Gross Salary (PKR)" value={fmt(resource.gross_salary)} />
                <Field label="Allowance Amount (PKR)" value={fmt(resource.allowance_amount)} />
                <Field label="Tax Amount (PKR)" value={fmt(resource.tax_amount)} />
                <Field label="Net Salary (PKR)" value={fmt(resource.net_salary)} />
                <Field label="Last Review Date" value={formatDate(resource.last_review_date)} />
                <Field label="Last Increment (PKR)" value={fmt(resource.last_increment_amount)} />
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
              <InventoryPanel resourceId={resource.id} toast={toast} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Resources() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [detail, setDetail]       = useState(null);
  const [addOpen, setAddOpen]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [filters, setFilters]     = useState({ search: '', employment_status: '', job_type: '' });
  const importRef = useRef();

  async function load() {
    setLoading(true);
    const params = {
      ...(activeWing?.id           ? { wing_id: activeWing.id }                         : {}),
      ...(filters.employment_status ? { employment_status: filters.employment_status }   : {}),
      ...(filters.job_type          ? { job_type: filters.job_type }                     : {}),
      ...(filters.search            ? { search: filters.search }                         : {}),
    };
    try {
      setResources((await api.get('/resources', { params })).data);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || '';
      toast(`Failed to load resources${detail ? ': ' + detail : ''}`, 'error');
    }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [activeWing, filters]);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/resources/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast(data.message, 'success');
      load();
    } catch (err) { toast(err.response?.data?.error || 'Import failed', 'error'); }
    finally { setImporting(false); }
  }

  function filt(k) { return e => setFilters(p => ({ ...p, [k]: e.target.value })); }
  const hasFilters = filters.search || filters.employment_status || filters.job_type;

  return (
    <div>
      <div className="page-header">
        <h1>Resources & HR</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={importRef}
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button
            className="btn btn-secondary"
            onClick={() => importRef.current?.click()}
            disabled={importing}
          >
            <Upload size={14} /> {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add Resource
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-control"
          style={{ maxWidth: 220, height: 34 }}
          placeholder="Search name…"
          value={filters.search}
          onChange={filt('search')}
        />
        <select className="form-control" style={{ maxWidth: 170, height: 34 }} value={filters.employment_status} onChange={filt('employment_status')}>
          <option value="">All Statuses</option>
          {['Permanent', 'Probation', '3rd party', 'Hybrid', 'Part time'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="form-control" style={{ maxWidth: 150, height: 34 }} value={filters.job_type} onChange={filt('job_type')}>
          <option value="">All Job Types</option>
          {['On-Site', 'Remote', 'Out Source', 'Part time'].map(j => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ search: '', employment_status: '', job_type: '' })}>
            Clear
          </button>
        )}
        <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {resources.length} record{resources.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12, minWidth: 1280 }}>
            <thead>
              <tr>
                <th style={{ width: 48 }}>ID</th>
                <th>Name</th>
                <th>Wing</th>
                <th>Designation</th>
                <th>CNIC</th>
                <th>Account No.</th>
                <th>Bank</th>
                <th>Transfer</th>
                <th>Job Type</th>
                <th>Status</th>
                <th>Join Date</th>
                <th style={{ textAlign: 'right' }}>Gross</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
                <th style={{ textAlign: 'right' }}>Net Salary</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>Loading…</td>
                </tr>
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: 48 }}>
                    <UserCheck size={32} style={{ opacity: 0.25, display: 'block', margin: '0 auto 8px' }} />
                    <span className="text-muted">No resources found. Import an Excel file or add one manually.</span>
                  </td>
                </tr>
              ) : resources.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(r)}>
                  <td className="text-muted font-mono" style={{ whiteSpace: 'nowrap' }}>{r.resource_seq_id ?? '—'}</td>
                  <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.full_name}</td>
                  <td>
                    {r.wing_code
                      ? <span className="badge badge-neutral" style={{ fontSize: 10 }}>{r.wing_code}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{r.designation || '—'}</td>
                  <td className="text-muted font-mono" style={{ whiteSpace: 'nowrap' }}>{r.cnic || '—'}</td>
                  <td className="text-muted font-mono">{r.account_number || '—'}</td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{r.bank_name || '—'}</td>
                  <td className="text-muted">{r.mode_of_transfer || '—'}</td>
                  <td>
                    {r.job_type
                      ? <span className="badge badge-info" style={{ fontSize: 10 }}>{r.job_type}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {r.employment_status
                      ? <span className={`badge ${r.employment_status === 'Permanent' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{r.employment_status}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.join_date)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.gross_salary)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(r.tax_amount)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{fmt(r.net_salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <AddModal
          wings={wings || []}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
          toast={toast}
        />
      )}

      {detail && (
        <DetailModal
          resource={detail}
          wings={wings || []}
          onClose={() => setDetail(null)}
          onSaved={() => { load(); setDetail(null); }}
          toast={toast}
        />
      )}
    </div>
  );
}

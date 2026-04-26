import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Plus, UserCheck } from 'lucide-react';

function ResourceModal({ resource, wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: resource?.name || '', type: resource?.type || 'employee', cnic: resource?.cnic || '', email: resource?.email || '', phone: resource?.phone || '' });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (resource) await api.put(`/resources/${resource.id}`, form);
      else          await api.post('/resources', form);
      toast(resource ? 'Updated' : 'Created', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>{resource ? 'Edit Resource' : 'Add Resource'}</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={f('name')} /></div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-control" value={form.type} onChange={f('type')}><option value="employee">Employee</option><option value="contractor">Contractor</option></select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">CNIC</label><input className="form-control" placeholder="12345-6789012-3" value={form.cnic} onChange={f('cnic')} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={f('phone')} /></div>
            </div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={f('email')} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Resources() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [resources, setResources] = useState([]);
  const [modal, setModal]         = useState(null);
  const [loading, setLoading]     = useState(true);

  async function load() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { setResources((await api.get('/resources', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing]);

  return (
    <div>
      <div className="page-header">
        <h1>Resources & HR</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15}/> Add Resource</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>CNIC</th><th>Phone</th><th>Email</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : resources.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><UserCheck size={28} style={{ opacity: .3, display: 'block', margin: '0 auto 8px' }}/>No resources</td></tr>
                : resources.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td><span className={`badge ${r.type === 'employee' ? 'badge-info' : 'badge-neutral'}`}>{r.type}</span></td>
                    <td className="text-muted font-mono">{r.cnic || '—'}</td>
                    <td className="text-muted">{r.phone || '—'}</td>
                    <td className="text-muted">{r.email || '—'}</td>
                    <td><span className={`badge ${r.is_active ? 'badge-success' : 'badge-neutral'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(r)}>✎</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal !== null && <ResourceModal resource={modal?.id ? modal : null} wings={wings} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Plus, Pencil, Building2 } from 'lucide-react';

function WingModal({ wing, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: wing?.name || '', code: wing?.code || '', description: wing?.description || '' });
  const [saving, setSaving] = useState(false);

  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (wing) { await api.put(`/wings/${wing.id}`, form); }
      else      { await api.post('/wings', form); }
      toast(wing ? 'Wing updated' : 'Wing created', 'success');
      onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{wing ? 'Edit Wing' : 'New Business Wing'}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-control" required value={form.name} onChange={f('name')} placeholder="Technology Services" />
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-control" required value={form.code} onChange={f('code')} placeholder="TECH" style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={2} value={form.description} onChange={f('description')} />
            </div>
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

export default function Wings() {
  const toast = useToast();
  const [wings, setWings]   = useState([]);
  const [modal, setModal]   = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setWings((await api.get('/wings')).data); }
    catch { toast('Failed to load wings', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Business Wings</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={15} /> New Wing
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Code</th><th>Description</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
              ) : wings.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                  <Building2 size={32} style={{ opacity: .3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  No wings yet
                </td></tr>
              ) : wings.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 500 }}>{w.name}</td>
                  <td><span className="badge badge-navy">{w.code}</span></td>
                  <td className="text-muted">{w.description || '—'}</td>
                  <td><span className={`badge ${w.is_active ? 'badge-success' : 'badge-neutral'}`}>{w.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(w)}>
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <WingModal wing={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

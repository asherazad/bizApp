import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { Plus, Pencil } from 'lucide-react';

function UserModal({ editUser, wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: editUser?.name || '', email: editUser?.email || '', password: '', role: editUser?.role || 'viewer', wing_ids: [] });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  function toggleWing(id) { setForm((p) => ({ ...p, wing_ids: p.wing_ids.includes(id) ? p.wing_ids.filter((x) => x !== id) : [...p.wing_ids, id] })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (editUser) await api.put(`/users/${editUser.id}`, form);
      else          await api.post('/users', form);
      toast(editUser ? 'Updated' : 'User created', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>{editUser ? 'Edit User' : 'New User'}</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={f('name')} /></div>
            {!editUser && <>
              <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-control" required value={form.email} onChange={f('email')} /></div>
              <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-control" required minLength={8} value={form.password} onChange={f('password')} /></div>
            </>}
            <div className="form-group"><label className="form-label">Role</label>
              <select className="form-control" value={form.role} onChange={f('role')}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Wing Access</label>
              {wings.map((w) => (
                <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.wing_ids.includes(w.id)} onChange={() => toggleWing(w.id)} />
                  {w.name}
                </label>
              ))}
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

export default function Users() {
  const { wings } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setUsers((await api.get('/users')).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15}/> New User</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td className="text-muted">{u.email}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'badge-navy' : u.role === 'manager' ? 'badge-info' : 'badge-neutral'}`}>{u.role}</span></td>
                    <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(u)}><Pencil size={13}/></button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal !== null && <UserModal editUser={modal?.id ? modal : null} wings={wings} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

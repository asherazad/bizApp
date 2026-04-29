import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react';

function UserModal({ editUser, wings, onClose, onSaved }) {
  const toast  = useToast();
  const isEdit = !!editUser?.id;

  const [form, setForm] = useState({
    full_name: editUser?.full_name || editUser?.name || '',
    email:     editUser?.email    || '',
    role:      editUser?.role     || 'viewer',
    is_active: editUser?.is_active ?? true,
    wing_ids:  editUser?.wing_ids  || [],
    password:  '',
  });
  const [pwForm, setPwForm]   = useState({ new_password: '', confirm_password: '' });
  const [saving, setSaving]   = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  function pw(k){ return (e) => setPwForm((p) => ({ ...p, [k]: e.target.value })); }
  function toggleWing(id) {
    setForm((p) => ({ ...p, wing_ids: p.wing_ids.includes(id) ? p.wing_ids.filter((x) => x !== id) : [...p.wing_ids, id] }));
  }

  async function submitProfile(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/users/${editUser.id}`, { full_name: form.full_name, email: form.email, role: form.role, is_active: form.is_active, wing_ids: form.wing_ids });
        toast('User updated', 'success');
      } else {
        if (!form.password) { toast('Password is required', 'error'); return; }
        await api.post('/users', { full_name: form.full_name, email: form.email, password: form.password, role: form.role, wing_ids: form.wing_ids });
        toast('User created', 'success');
      }
      onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  async function submitPassword(e) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) { toast('Passwords do not match', 'error'); return; }
    if (pwForm.new_password.length < 8) { toast('Min 8 characters', 'error'); return; }
    setSavingPw(true);
    try {
      await api.put(`/users/${editUser.id}/reset-password`, pwForm);
      toast('Password updated', 'success');
      setPwForm({ new_password: '', confirm_password: '' });
      setShowPw(false);
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSavingPw(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit User' : 'New User'}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submitProfile}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label className="form-label">Full Name *</label>
              <input className="form-control" required value={form.full_name} onChange={f('full_name')} />
            </div>
            <div className="form-group"><label className="form-label">Email *</label>
              <input type="email" className="form-control" required value={form.email} onChange={f('email')} />
            </div>
            {!isEdit && (
              <div className="form-group"><label className="form-label">Password *</label>
                <input type="password" className="form-control" required minLength={8} value={form.password} onChange={f('password')} placeholder="Min 8 characters" />
              </div>
            )}
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Role</label>
                <select className="form-control" value={form.role} onChange={f('role')}>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              {isEdit && (
                <div className="form-group"><label className="form-label">Status</label>
                  <select className="form-control" value={String(form.is_active)} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === 'true' }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              )}
            </div>
            <div className="form-group"><label className="form-label">Wing Access</label>
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
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}</button>
          </div>
        </form>

        {/* Change Password — edit mode only */}
        {isEdit && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 24px' }}>
            <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowPw((p) => !p)}>
              <KeyRound size={13} /> {showPw ? 'Cancel' : 'Change Password'}
            </button>
            {showPw && (
              <form onSubmit={submitPassword} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group"><label className="form-label">New Password *</label>
                  <input type="password" className="form-control" required minLength={8} value={pwForm.new_password} onChange={pw('new_password')} placeholder="Min 8 characters" />
                </div>
                <div className="form-group"><label className="form-label">Confirm Password *</label>
                  <input type="password" className="form-control" required minLength={8} value={pwForm.confirm_password} onChange={pw('confirm_password')} />
                </div>
                {pwForm.new_password && pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                  <div style={{ fontSize: 12, color: 'var(--danger)' }}>Passwords do not match</div>
                )}
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingPw || pwForm.new_password !== pwForm.confirm_password}>
                  {savingPw ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Users() {
  const { user: me, wings } = useAuth();
  const toast = useToast();
  const [users, setUsers]     = useState([]);
  const [modal, setModal]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // user id to delete
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setUsers((await api.get('/users')).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(u) {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      toast(u.is_active ? 'User deactivated' : 'User activated', 'success');
      load();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
  }

  async function deleteUser(id) {
    try {
      await api.delete(`/users/${id}`);
      toast('User deleted', 'success');
      setConfirmDelete(null);
      load();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> New User</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td className="text-muted">{u.email}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'badge-navy' : u.role === 'manager' ? 'badge-info' : 'badge-neutral'}`}>{u.role}</span></td>
                    <td>
                      {confirmDelete === u.id ? (
                        <span style={{ fontSize: 12 }}>
                          Delete?{' '}
                          <button className="btn btn-sm" style={{ color: 'var(--danger)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }} onClick={() => deleteUser(u.id)}>Yes</button>
                          {' / '}
                          <button className="btn btn-sm" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }} onClick={() => setConfirmDelete(null)}>No</button>
                        </span>
                      ) : (
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal(u)} title="Edit">
                          <Pencil size={13} />
                        </button>
                        {u.id !== me?.id && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => toggleActive(u)}
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', padding: '4px 8px' }}
                              onClick={() => setConfirmDelete(u.id)}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal !== null && (
        <UserModal editUser={modal?.id ? modal : null} wings={wings} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

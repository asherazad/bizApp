import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { Plus, Pencil, Trash2, KeyRound, Shield, ShieldOff, CheckSquare, Square } from 'lucide-react';

// ─── Permission definitions ───────────────────────────────────────────────────
const PERM_GROUPS = [
  {
    label: 'Finance', color: '#ef5f28',
    perms: [
      { key: 'invoices_view',       label: 'View Invoices' },
      { key: 'invoices_create',     label: 'Create Invoices' },
      { key: 'invoices_receive',    label: 'Mark as Received' },
      { key: 'po_view',             label: 'View Purchase Orders' },
      { key: 'po_create',           label: 'Create POs' },
      { key: 'banks_view',          label: 'View Bank Accounts' },
      { key: 'banks_transact',      label: 'Add Bank Transaction' },
      { key: 'bills_view',          label: 'View Bills' },
      { key: 'bills_create',        label: 'Add Bills' },
      { key: 'bills_pay',           label: 'Mark Bill as Paid' },
      { key: 'creditcard_view',     label: 'View Credit Card' },
      { key: 'creditcard_transact', label: 'CC Payments' },
      { key: 'tax_view',            label: 'View Tax Challans' },
      { key: 'tax_create',          label: 'Add Tax Challan' },
    ],
  },
  {
    label: 'HR', color: '#3CB9FF',
    perms: [
      { key: 'resources_view',    label: 'View Resources' },
      { key: 'resources_create',  label: 'Add / Edit Resources' },
      { key: 'attendance_view',   label: 'View Attendance' },
      { key: 'attendance_edit',   label: 'Edit / Import Attendance' },
      { key: 'payroll_view',      label: 'View Payroll' },
      { key: 'payroll_process',   label: 'Process Payroll' },
      { key: 'loans_view',        label: 'View Loans' },
      { key: 'loans_create',      label: 'Add Loans' },
    ],
  },
  {
    label: 'Operations', color: '#00C9A7',
    perms: [
      { key: 'travel_view',          label: 'View Travel' },
      { key: 'travel_create',        label: 'Add Travel' },
      { key: 'subscriptions_view',   label: 'View Subscriptions' },
      { key: 'subscriptions_create', label: 'Add Subscriptions' },
      { key: 'reminders_view',       label: 'View Reminders' },
      { key: 'reminders_create',     label: 'Add Reminders' },
      { key: 'clients_view',         label: 'View Clients' },
      { key: 'clients_create',       label: 'Add / Edit Clients' },
      { key: 'reports_view',         label: 'View Reports' },
    ],
  },
];

const ALL_KEYS      = PERM_GROUPS.flatMap(g => g.perms.map(p => p.key));
const VIEW_KEYS     = ALL_KEYS.filter(k => k.endsWith('_view'));
const emptyPerms    = () => Object.fromEntries(ALL_KEYS.map(k => [k, false]));
const viewOnlyPerms = () => Object.fromEntries(ALL_KEYS.map(k => [k, k.endsWith('_view')]));
const fullPerms     = () => Object.fromEntries(ALL_KEYS.map(k => [k, true]));

// Build wing-access state map from API response
function toAccessMap(wingAccess = [], allWings = []) {
  const map = {};
  for (const w of allWings) {
    const grant = wingAccess.find(a => a.wing_id === w.id);
    map[w.id] = {
      enabled:     !!grant,
      permissions: grant ? { ...emptyPerms(), ...grant.permissions } : emptyPerms(),
    };
  }
  return map;
}

// Convert state map → API array
function fromAccessMap(map) {
  return Object.entries(map)
    .filter(([, v]) => v.enabled)
    .map(([wing_id, v]) => ({ wing_id, permissions: v.permissions }));
}

// ─── Permission group block ───────────────────────────────────────────────────
function PermGroup({ group, perms, onChange }) {
  const groupKeys   = group.perms.map(p => p.key);
  const allChecked  = groupKeys.every(k => perms[k]);
  const someChecked = groupKeys.some(k => perms[k]);

  function toggleAll() {
    const next = !allChecked;
    const updated = { ...perms };
    groupKeys.forEach(k => { updated[k] = next; });
    onChange(updated);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: group.color }}>
          {group.label}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
        <button
          type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-3)', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3 }}
          onClick={toggleAll}
        >
          {allChecked
            ? <CheckSquare size={12} color={group.color}/>
            : someChecked
              ? <CheckSquare size={12} color="var(--ink-4)"/>
              : <Square size={12} color="var(--ink-4)"/>
          }
          {allChecked ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        {group.perms.map(p => (
          <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', padding: '2px 0' }}>
            <input
              type="checkbox"
              checked={!!perms[p.key]}
              onChange={e => onChange({ ...perms, [p.key]: e.target.checked })}
              style={{ accentColor: group.color, width: 13, height: 13, flexShrink: 0 }}
            />
            {p.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Per-wing access block ─────────────────────────────────────────────────────
function WingAccessBlock({ wing, access, onChange }) {
  const { enabled, permissions } = access;

  function setEnabled(val) {
    onChange({ enabled: val, permissions: val ? viewOnlyPerms() : emptyPerms() });
  }

  function setPreset(preset) {
    onChange({ enabled: true, permissions: preset === 'full' ? fullPerms() : viewOnlyPerms() });
  }

  function setPerms(p) {
    onChange({ ...access, permissions: p });
  }

  const grantedCount = Object.values(permissions).filter(Boolean).length;

  return (
    <div style={{ border: `1px solid ${enabled ? 'var(--electric-border)' : 'var(--border)'}`, borderRadius: 'var(--r)', marginBottom: 10, overflow: 'hidden', background: enabled ? 'var(--surface)' : 'var(--surface-3)' }}>
      {/* Wing header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: enabled ? 'var(--electric-focus)' : 'transparent' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, minWidth: 0 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            style={{ accentColor: 'var(--electric)', width: 15, height: 15 }}
          />
          <span style={{ fontWeight: 700, fontSize: 13 }}>{wing.name}</span>
          {wing.code && <span style={{ fontSize: 10, color: 'var(--ink-3)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>{wing.code}</span>}
        </label>
        {enabled && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{grantedCount}/{ALL_KEYS.length} permissions</span>
            <button type="button" className="btn btn-secondary" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => setPreset('view')}>View Only</button>
            <button type="button" className="btn btn-secondary" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => setPreset('full')}>Full Access</button>
          </div>
        )}
      </div>

      {/* Permission groups */}
      {enabled && (
        <div style={{ padding: '12px 14px' }}>
          {PERM_GROUPS.map(g => (
            <PermGroup key={g.label} group={g} perms={permissions} onChange={setPerms}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function UserModal({ editUser, allWings, onClose, onSaved }) {
  const toast  = useToast();
  const isEdit = !!editUser?.id;
  const [tab,  setTab]    = useState('profile');
  const [saving, setSaving]   = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [form, setForm] = useState({
    full_name:  editUser?.full_name || editUser?.name || '',
    email:      editUser?.email     || '',
    role:       editUser?.role      || 'viewer',
    is_active:  editUser?.is_active ?? true,
    password:   '',
  });

  const [pwForm, setPwForm] = useState({ new_password: '', confirm_password: '' });

  const [wingAccess, setWingAccess] = useState(
    () => toAccessMap(editUser?.wing_access || [], allWings)
  );

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  function setWingEntry(wingId, val) {
    setWingAccess(p => ({ ...p, [wingId]: val }));
  }

  const accessList = fromAccessMap(wingAccess);
  const enabledCount = accessList.length;

  async function submitProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        full_name:   form.full_name,
        email:       form.email,
        role:        form.role,
        is_active:   form.is_active,
        wing_access: accessList,
      };
      if (isEdit) {
        await api.put(`/users/${editUser.id}`, payload);
        toast('User updated', 'success');
      } else {
        if (!form.password) { toast('Password is required', 'error'); return; }
        await api.post('/users', { ...payload, password: form.password });
        toast('User created', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Error saving user', 'error');
    } finally {
      setSaving(false);
    }
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
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    } finally {
      setSavingPw(false);
    }
  }

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'access',  label: `Wing Access${enabledCount ? ` (${enabledCount})` : ''}` },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720, width: '96vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? `Edit — ${editUser.name || editUser.full_name}` : 'New User'}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                color: tab === t.key ? 'var(--electric)' : 'var(--ink-3)',
                borderBottom: tab === t.key ? '2px solid var(--electric)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{t.label}</button>
          ))}
        </div>

        <form onSubmit={submitProfile}>
          {/* ── Profile Tab ── */}
          {tab === 'profile' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" required value={form.full_name} onChange={f('full_name')}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" required value={form.email} onChange={f('email')}/>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={form.role} onChange={f('role')}>
                    <option value="admin">Admin — full access to everything</option>
                    <option value="manager">Manager — governed by wing permissions</option>
                    <option value="viewer">Viewer — governed by wing permissions</option>
                  </select>
                </div>
                {isEdit && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={String(form.is_active)} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              {!isEdit && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-control" required minLength={8} value={form.password} onChange={f('password')} placeholder="Min 8 characters"/>
                </div>
              )}

              {form.role === 'admin' && (
                <div style={{ background: 'var(--electric-light)', border: '1px solid var(--electric-border)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 12, color: 'var(--electric-dark)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
                  <span>Admin users have full access to all wings and all features. Wing permissions in the Access tab are ignored for admins.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Access Tab ── */}
          {tab === 'access' && (
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {form.role === 'admin' ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
                  <Shield size={32} style={{ marginBottom: 8, opacity: 0.4 }}/>
                  <div style={{ fontSize: 13 }}>Admin users have unrestricted access. Switch to Manager or Viewer role to configure per-wing permissions.</div>
                </div>
              ) : allWings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)', fontSize: 13 }}>No business wings found.</div>
              ) : (
                <>
                  <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--ink-3)' }}>
                    Check a wing to grant access. By default, new wings are given View Only permissions — enable specific actions below.
                  </div>
                  {allWings.map(w => (
                    <WingAccessBlock
                      key={w.id}
                      wing={w}
                      access={wingAccess[w.id] || { enabled: false, permissions: emptyPerms() }}
                      onChange={val => setWingEntry(w.id, val)}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>

        {/* Change Password (edit only) */}
        {isEdit && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 24px' }}>
            <button type="button" className="btn btn-secondary btn-sm" style={{ gap: 6 }} onClick={() => setShowPw(p => !p)}>
              <KeyRound size={13}/> {showPw ? 'Cancel' : 'Change Password'}
            </button>
            {showPw && (
              <form onSubmit={submitPassword} style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <input type="password" className="form-control" required minLength={8} value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} placeholder="Min 8 chars"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password *</label>
                  <input type="password" className="form-control" required minLength={8} value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}/>
                </div>
                {pwForm.new_password && pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                  <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--danger)' }}>Passwords do not match</div>
                )}
                <div style={{ gridColumn: '1/-1' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingPw || pwForm.new_password !== pwForm.confirm_password}>
                    {savingPw ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cls = role === 'admin' ? 'badge-navy' : role === 'manager' ? 'badge-info' : 'badge-neutral';
  return <span className={`badge ${cls}`}>{role}</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Users() {
  const { user: me } = useAuth();
  const toast        = useToast();

  const [users,    setUsers]   = useState([]);
  const [allWings, setAllWings] = useState([]);
  const [modal,    setModal]   = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [loading,  setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [u, w] = await Promise.all([api.get('/users'), api.get('/wings')]);
      setUsers(u.data);
      setAllWings(w.data);
    } catch {
      toast('Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(u) {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      toast(u.is_active ? 'User deactivated' : 'User activated', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    }
  }

  async function deleteUser(id) {
    try {
      await api.delete(`/users/${id}`);
      toast('User deleted', 'success');
      setDelTarget(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={15}/> New User
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Wing Access</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{u.email}</div>
                  </td>
                  <td><RoleBadge role={u.role}/></td>
                  <td>
                    {u.role === 'admin' ? (
                      <span style={{ fontSize: 11, color: 'var(--electric)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={11}/> All Wings
                      </span>
                    ) : u.wing_access?.length ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {u.wing_access.map(wa => {
                          const w = allWings.find(x => x.id === wa.wing_id);
                          const count = Object.values(wa.permissions || {}).filter(Boolean).length;
                          return (
                            <span key={wa.wing_id} title={`${count} permissions`}
                              style={{ fontSize: 11, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 8px', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              {w?.name || wa.wing_id}
                              <span style={{ color: 'var(--ink-4)', fontWeight: 600 }}>{count}p</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>No access</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal(u)} title="Edit user & permissions">
                        <Pencil size={13}/>
                      </button>
                      {u.id !== me?.id && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? <ShieldOff size={13}/> : <Shield size={13}/>}
                          </button>
                          {delTarget === u.id ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                              <button className="btn btn-sm" style={{ color: 'var(--danger)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => deleteUser(u.id)}>Delete?</button>
                              <button className="btn btn-sm" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }} onClick={() => setDelTarget(null)}>Cancel</button>
                            </span>
                          ) : (
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', padding: '4px 8px' }}
                              onClick={() => setDelTarget(u.id)}
                              title="Delete user"
                            >
                              <Trash2 size={13}/>
                            </button>
                          )}
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
        <UserModal
          editUser={modal?.id ? modal : null}
          allWings={allWings}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

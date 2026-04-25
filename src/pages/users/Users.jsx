import { useState, useEffect, useMemo, useCallback } from 'react'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, Avatar, StatusPill, SearchInput, ConfirmModal, EmptyState, Spinner } from '../../components/ui/index'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../lib/format'
import api from '../../lib/api'

const EMPTY_FORM = { full_name: '', email: '', password: '', department_id: '', role_ids: [] }

export default function Users() {
  const canWrite  = usePermission('users', 'write')
  const toast     = useToast()

  const [users, setUsers]           = useState([])
  const [roles, setRoles]           = useState([])
  const [departments, setDepts]     = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  const [showCreate, setShowCreate]   = useState(false)
  const [editTarget, setEditTarget]   = useState(null)   // user being edited
  const [rolesTarget, setRolesTarget] = useState(null)   // user for role modal
  const [bizTarget, setBizTarget]     = useState(null)   // user for business modal
  const [confirmDeact, setConfirmDeact] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    try {
      const [usersRes, rolesRes, deptsRes] = await Promise.all([
        api.get('/users'),
        api.get('/roles'),
        api.get('/departments'),
      ])
      setUsers(usersRes.data)
      setRoles(rolesRes.data)
      setDepts(deptsRes.data)
      // Businesses load may fail if user lacks permission — that's fine
      try {
        const bizRes = await api.get('/businesses')
        setBusinesses(bizRes.data)
      } catch {
        setBusinesses([])
      }
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
    users.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    ), [users, search])

  // ── Create user ──────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/users', form)
      setUsers(prev => [...prev, res.data])
      setShowCreate(false)
      setForm(EMPTY_FORM)
      toast.success(`${res.data.full_name} created`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit user details ────────────────────────────────────
  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put(`/users/${editTarget.id}`, {
        full_name:     editTarget.full_name,
        email:         editTarget.email,
        department_id: editTarget.department_id,
      })
      setUsers(prev => prev.map(u => u.id === res.data.id ? res.data : u))
      setEditTarget(null)
      toast.success('User updated')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  // ── Update roles ─────────────────────────────────────────
  async function handleRolesUpdate() {
    setSaving(true)
    try {
      const res = await api.patch(`/users/${rolesTarget.id}/roles`, {
        role_ids: rolesTarget.role_ids,
      })
      setUsers(prev => prev.map(u => u.id === res.data.id ? res.data : u))
      setRolesTarget(null)
      toast.success('Roles updated')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update roles')
    } finally {
      setSaving(false)
    }
  }

  // ── Update business access ───────────────────────────────
  async function handleBizUpdate() {
    setSaving(true)
    try {
      const res = await api.patch(`/users/${bizTarget.id}/businesses`, {
        tenant_ids: bizTarget.tenant_ids,
      })
      setUsers(prev => prev.map(u => u.id === res.data.id ? res.data : u))
      setBizTarget(null)
      toast.success('Business access updated')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update business access')
    } finally {
      setSaving(false)
    }
  }

  // ── Deactivate ───────────────────────────────────────────
  async function handleStatusToggle(user, is_active) {
    try {
      const res = await api.patch(`/users/${user.id}/status`, { is_active })
      setUsers(prev => prev.map(u => u.id === res.data.id ? res.data : u))
      toast.success(is_active ? `${user.full_name} reactivated` : `${user.full_name} deactivated`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update status')
    }
  }

  function openRolesModal(user) {
    setRolesTarget({ ...user, role_ids: (user.roles || []).map(r => r.id) })
  }

  function openBizModal(user) {
    setBizTarget({
      ...user,
      tenant_ids: (user.businesses || []).map(b => b.id),
    })
  }

  function toggleRoleId(id) {
    setRolesTarget(prev => ({
      ...prev,
      role_ids: prev.role_ids.includes(id)
        ? prev.role_ids.filter(r => r !== id)
        : [...prev.role_ids, id],
    }))
  }

  function toggleTenantId(id) {
    setBizTarget(prev => ({
      ...prev,
      tenant_ids: prev.tenant_ids.includes(id)
        ? prev.tenant_ids.filter(t => t !== id)
        : [...prev.tenant_ids, id],
    }))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <Topbar title="Users" subtitle="Loading…" />
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Spinner size={24} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar
        title="Users"
        subtitle={`${users.filter(u => u.is_active).length} active`}
        actions={canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add user
          </button>
        )}
      />

      <div className="page">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search users…" style={{ width: 260 }} />
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Department</th>
                  <th>Roles</th><th>Businesses</th><th>Last login</th><th>Status</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><EmptyState title="No users found" message="Try a different search term or add a user." /></td></tr>
                )}
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar name={u.full_name} size={28} />
                        <span style={{ fontWeight: 500 }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{u.department_name ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(u.roles || []).length === 0
                          ? <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>No role</span>
                          : (u.roles || []).map(r => (
                              <span key={r.id} className="pill pill-blue" style={{ fontSize: 10 }}>{r.name}</span>
                            ))
                        }
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(u.businesses || []).length === 0
                          ? <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>
                          : (u.businesses || []).map(b => (
                              <span key={b.id} className="pill pill-gray" style={{ fontSize: 10 }}>{b.name}</span>
                            ))
                        }
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(u.last_login)}</td>
                    <td><StatusPill status={u.is_active ? 'active' : 'inactive'} /></td>
                    {canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget({ ...u })}>Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openRolesModal(u)}>Roles</button>
                          {businesses.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => openBizModal(u)}>Businesses</button>
                          )}
                          {u.is_active
                            ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                                onClick={() => setConfirmDeact(u)}>Deactivate</button>
                            : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--teal-700)' }}
                                onClick={() => handleStatusToggle(u, true)}>Reactivate</button>
                          }
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Create user modal ─────────────────────────────── */}
      {showCreate && (
        <Modal
          title="Add user"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" form="create-form" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create user'}
              </button>
            </>
          }
        >
          <form id="create-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="label">Full name</label>
              <input className="input" required placeholder="Jane Smith"
                value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Email address</label>
              <input className="input" type="email" required placeholder="jane@company.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6} placeholder="Min. 6 characters"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Department</label>
              <select className="input" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Role(s)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
                {roles.map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox"
                      checked={form.role_ids.includes(r.id)}
                      onChange={e => setForm(f => ({
                        ...f,
                        role_ids: e.target.checked
                          ? [...f.role_ids, r.id]
                          : f.role_ids.filter(id => id !== r.id),
                      }))}
                    />
                    <span>{r.name}</span>
                    {r.is_system && <span className="pill pill-gray" style={{ fontSize: 9 }}>system</span>}
                  </label>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit user modal ───────────────────────────────── */}
      {editTarget && (
        <Modal
          title="Edit user"
          onClose={() => setEditTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" form="edit-form" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          }
        >
          <form id="edit-form" onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="label">Full name</label>
              <input className="input" required value={editTarget.full_name}
                onChange={e => setEditTarget(t => ({ ...t, full_name: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Email address</label>
              <input className="input" type="email" required value={editTarget.email}
                onChange={e => setEditTarget(t => ({ ...t, email: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Department</label>
              <select className="input" value={editTarget.department_id ?? ''}
                onChange={e => setEditTarget(t => ({ ...t, department_id: e.target.value }))}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign roles modal ────────────────────────────── */}
      {rolesTarget && (
        <Modal
          title={`Roles — ${rolesTarget.full_name}`}
          onClose={() => setRolesTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setRolesTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRolesUpdate} disabled={saving}>
                {saving ? 'Saving…' : 'Update roles'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roles.map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox"
                  checked={rolesTarget.role_ids.includes(r.id)}
                  onChange={() => toggleRoleId(r.id)}
                />
                <span style={{ flex: 1 }}>{r.name}</span>
                {r.is_system && <span className="pill pill-gray" style={{ fontSize: 9 }}>system</span>}
                {r.user_count > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.user_count} users</span>
                )}
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Assign businesses modal ───────────────────────── */}
      {bizTarget && (
        <Modal
          title={`Business access — ${bizTarget.full_name}`}
          onClose={() => setBizTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setBizTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBizUpdate} disabled={saving}>
                {saving ? 'Saving…' : 'Update access'}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Select the businesses this user can access and manage.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {businesses.map(b => (
              <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox"
                  checked={bizTarget.tenant_ids.includes(b.id)}
                  onChange={() => toggleTenantId(b.id)}
                />
                <span style={{ flex: 1 }}>{b.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{b.slug}</span>
                <StatusPill status={b.is_active ? 'active' : 'inactive'} />
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Deactivate confirm ────────────────────────────── */}
      {confirmDeact && (
        <ConfirmModal
          title="Deactivate user"
          message={`Are you sure you want to deactivate ${confirmDeact.full_name}? They will lose access immediately.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={() => handleStatusToggle(confirmDeact, false)}
          onClose={() => setConfirmDeact(null)}
        />
      )}
    </div>
  )
}

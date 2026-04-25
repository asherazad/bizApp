import { useState, useEffect, useCallback } from 'react'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, Avatar, StatusPill, SearchInput, ConfirmModal, EmptyState, Spinner } from '../../components/ui/index'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../lib/format'
import api from '../../lib/api'

const PLANS = ['starter', 'pro', 'enterprise']
const EMPTY_FORM = { name: '', slug: '', plan: 'starter' }

export default function Businesses() {
  const canWrite  = usePermission('businesses', 'write')
  const toast     = useToast()

  const [businesses, setBusinesses] = useState([])
  const [allUsers, setAllUsers]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  const [selected, setSelected]     = useState(null)  // business detail panel
  const [assignedUsers, setAssigned]= useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [userSearch, setUserSearch] = useState('')

  const load = useCallback(async () => {
    try {
      const [bizRes, usersRes] = await Promise.all([
        api.get('/businesses'),
        api.get('/users'),
      ])
      setBusinesses(bizRes.data)
      setAllUsers(usersRes.data)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const loadDetail = useCallback(async (biz) => {
    setSelected(biz)
    setLoadingDetail(true)
    setUserSearch('')
    try {
      const res = await api.get(`/businesses/${biz.id}/assigned-users`)
      setAssigned(res.data)
    } catch {
      setAssigned([])
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.slug.toLowerCase().includes(search.toLowerCase())
  )

  // ── Create business ──────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/businesses', form)
      setBusinesses(prev => [...prev, res.data])
      setShowCreate(false)
      setForm(EMPTY_FORM)
      toast.success(`Business "${res.data.name}" created`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to create business')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit business ────────────────────────────────────────
  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put(`/businesses/${editTarget.id}`, {
        name: editTarget.name,
        plan: editTarget.plan,
      })
      setBusinesses(prev => prev.map(b => b.id === res.data.id ? { ...b, ...res.data } : b))
      if (selected?.id === res.data.id) setSelected(s => ({ ...s, ...res.data }))
      setEditTarget(null)
      toast.success('Business updated')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update business')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle status ────────────────────────────────────────
  async function handleStatusToggle(biz, is_active) {
    try {
      const res = await api.patch(`/businesses/${biz.id}/status`, { is_active })
      setBusinesses(prev => prev.map(b => b.id === res.data.id ? { ...b, ...res.data } : b))
      if (selected?.id === res.data.id) setSelected(s => ({ ...s, ...res.data }))
      toast.success(is_active ? 'Business activated' : 'Business deactivated')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update status')
    }
  }

  // ── Assign user to business ──────────────────────────────
  async function assignUser(userId) {
    try {
      await api.post(`/businesses/${selected.id}/assign-user`, { user_id: userId })
      const user = allUsers.find(u => u.id === userId)
      setAssigned(prev => [...prev, { ...user, granted_at: new Date().toISOString() }])
      setBusinesses(prev => prev.map(b => b.id === selected.id
        ? { ...b, user_count: (b.user_count || 0) + 1 }
        : b
      ))
      toast.success(`${user?.full_name ?? 'User'} assigned`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to assign user')
    }
  }

  // ── Remove user from business ────────────────────────────
  async function removeUser(userId, userName) {
    try {
      await api.delete(`/businesses/${selected.id}/assign-user/${userId}`)
      setAssigned(prev => prev.filter(u => u.id !== userId))
      setBusinesses(prev => prev.map(b => b.id === selected.id
        ? { ...b, user_count: Math.max(0, (b.user_count || 1) - 1) }
        : b
      ))
      toast.success(`${userName} removed`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to remove user')
    }
  }

  const assignedIds = new Set(assignedUsers.map(u => u.id))
  const availableUsers = allUsers.filter(u =>
    !assignedIds.has(u.id) &&
    u.is_active &&
    (u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
     u.email.toLowerCase().includes(userSearch.toLowerCase()))
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <Topbar title="Businesses" subtitle="Loading…" />
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Spinner size={24} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar
        title="Businesses"
        subtitle={`${businesses.length} businesses`}
        actions={canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New business
          </button>
        )}
      />

      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>
          {/* ── Business list ────────────────────────────── */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search businesses…" style={{ width: 260 }} />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Business</th><th>Slug</th><th>Plan</th><th>Users</th>
                      <th>Created</th><th>Status</th>
                      {canWrite && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={7}>
                        <EmptyState title="No businesses" message="Create your first business to get started." />
                      </td></tr>
                    )}
                    {filtered.map(b => (
                      <tr key={b.id}
                        style={{ cursor: 'pointer', background: selected?.id === b.id ? 'var(--blue-50)' : undefined }}
                        onClick={() => loadDetail(b)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 6, background: 'var(--blue-100)',
                              color: 'var(--blue-800)', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                            }}>
                              {b.name[0].toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 500 }}>{b.name}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{b.slug}</td>
                        <td><span className="pill pill-gray" style={{ fontSize: 10 }}>{b.plan}</span></td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{b.user_count ?? 0}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(b.created_at)}</td>
                        <td><StatusPill status={b.is_active ? 'active' : 'inactive'} /></td>
                        {canWrite && (
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-sm"
                                onClick={() => setEditTarget({ ...b })}>Edit</button>
                              {b.is_active
                                ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                                    onClick={() => setConfirmToggle({ biz: b, is_active: false })}>Disable</button>
                                : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--teal-700)' }}
                                    onClick={() => handleStatusToggle(b, true)}>Enable</button>
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

          {/* ── Business detail / user assignment ────────── */}
          {selected && (
            <div className="card" style={{ position: 'sticky', top: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {selected.slug} · {selected.plan}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelected(null)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Assigned managers ({assignedUsers.length})
              </div>

              {loadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner /></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                  {assignedUsers.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 0' }}>No users assigned yet.</p>
                  )}
                  {assignedUsers.map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <Avatar name={u.full_name} size={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                      </div>
                      {canWrite && (
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--red-600)', flexShrink: 0 }}
                          onClick={() => removeUser(u.id, u.full_name)} title="Remove">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canWrite && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Add user
                  </div>
                  <SearchInput value={userSearch} onChange={setUserSearch} placeholder="Search users…" style={{ marginBottom: 8 }} />
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {availableUsers.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
                        {userSearch ? 'No matches.' : 'All active users are already assigned.'}
                      </p>
                    )}
                    {availableUsers.map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                        <Avatar name={u.full_name} size={22} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}
                          onClick={() => assignUser(u.id)}>
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create business modal ─────────────────────────── */}
      {showCreate && (
        <Modal title="New business" onClose={() => setShowCreate(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" form="create-biz-form" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </>
          }
        >
          <form id="create-biz-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="label">Business name</label>
              <input className="input" required placeholder="Acme Corp"
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  setForm(f => ({ ...f, name, slug }))
                }}
              />
            </div>
            <div className="field">
              <label className="label">Slug <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(used in subdomain / header)</span></label>
              <input className="input" required placeholder="acme-corp"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
              />
            </div>
            <div className="field">
              <label className="label">Plan</label>
              <select className="input" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit business modal ───────────────────────────── */}
      {editTarget && (
        <Modal title="Edit business" onClose={() => setEditTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" form="edit-biz-form" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <form id="edit-biz-form" onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="label">Business name</label>
              <input className="input" required value={editTarget.name}
                onChange={e => setEditTarget(t => ({ ...t, name: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Plan</label>
              <select className="input" value={editTarget.plan}
                onChange={e => setEditTarget(t => ({ ...t, plan: e.target.value }))}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Disable confirm ───────────────────────────────── */}
      {confirmToggle && (
        <ConfirmModal
          title="Disable business"
          message={`Disable "${confirmToggle.biz.name}"? All users in this business will lose access.`}
          confirmLabel="Disable"
          danger
          onConfirm={() => handleStatusToggle(confirmToggle.biz, false)}
          onClose={() => setConfirmToggle(null)}
        />
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, Avatar, StatusPill, SearchInput, ConfirmModal, EmptyState } from '../../components/ui/index'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../context/ToastContext'
import { mockUsers, mockDepartments, mockRoles } from '../../lib/mockData'
import { formatDate } from '../../lib/format'

export default function Users() {
  const canWrite              = usePermission('users','write')
  const toast                 = useToast()
  const [users, setUsers]     = useState(mockUsers)
  const [search, setSearch]   = useState('')
  const [showInvite, setShowInvite]     = useState(false)
  const [confirmDeact, setConfirmDeact] = useState(null)

  // Invite form state
  const [form, setForm] = useState({ full_name:'', email:'', department_id:'', role_ids:[] })

  const filtered = useMemo(() =>
    users.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    ), [users, search])

  function handleInvite(e) {
    e.preventDefault()
    const newUser = {
      id: `user-${Date.now()}`,
      ...form,
      is_active: true,
      last_login: null,
    }
    setUsers(prev => [...prev, newUser])
    setShowInvite(false)
    setForm({ full_name:'', email:'', department_id:'', role_ids:[] })
    toast.success(`${newUser.full_name} invited successfully`)
  }

  function handleDeactivate(userId) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u))
    toast.success('User deactivated')
  }

  function getDeptName(id) {
    return mockDepartments.find(d => d.id === id)?.name ?? '—'
  }

  function getRoleNames(ids = []) {
    return ids.map(id => mockRoles.find(r => r.id === id)?.name ?? id).join(', ')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar
        title="Users"
        subtitle={`${users.filter(u=>u.is_active).length} active`}
        actions={canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Invite user
          </button>
        )}
      />

      <div className="page">
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search users…" style={{ width: 260 }}/>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Department</th>
                  <th>Roles</th><th>Last login</th><th>Status</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7}><EmptyState title="No users found" message="Try a different search term." /></td></tr>
                )}
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <Avatar name={u.full_name} size={28}/>
                        <span style={{ fontWeight:500 }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td style={{ color:'var(--text-secondary)' }}>{u.email}</td>
                    <td>{getDeptName(u.department_id)}</td>
                    <td style={{ color:'var(--text-secondary)', fontSize:12 }}>{getRoleNames(u.role_ids)}</td>
                    <td style={{ color:'var(--text-secondary)', fontSize:12 }}>{formatDate(u.last_login)}</td>
                    <td><StatusPill status={u.is_active ? 'active' : 'inactive'}/></td>
                    {canWrite && (
                      <td>
                        {u.is_active && (
                          <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-600)' }}
                            onClick={() => setConfirmDeact(u)}>
                            Deactivate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <Modal
          title="Invite user"
          onClose={() => setShowInvite(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="btn btn-primary" form="invite-form" type="submit">Send invite</button>
            </>
          }
        >
          <form id="invite-form" onSubmit={handleInvite} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="field">
              <label className="label">Full name</label>
              <input className="input" required placeholder="Jane Smith"
                value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))}/>
            </div>
            <div className="field">
              <label className="label">Email address</label>
              <input className="input" type="email" required placeholder="jane@company.com"
                value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}/>
            </div>
            <div className="field">
              <label className="label">Department</label>
              <select className="input" value={form.department_id} onChange={e => setForm(f => ({...f, department_id: e.target.value}))}>
                <option value="">— Select department —</option>
                {mockDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Role</label>
              <select className="input" value={form.role_ids[0] ?? ''} onChange={e => setForm(f => ({...f, role_ids: [e.target.value]}))}>
                <option value="">— Select role —</option>
                {mockRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* Deactivate confirm */}
      {confirmDeact && (
        <ConfirmModal
          title="Deactivate user"
          message={`Are you sure you want to deactivate ${confirmDeact.full_name}? They will lose access immediately.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={() => handleDeactivate(confirmDeact.id)}
          onClose={() => setConfirmDeact(null)}
        />
      )}
    </div>
  )
}

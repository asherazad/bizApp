import { useState, useEffect, useCallback } from 'react'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, EmptyState, ConfirmModal, Spinner } from '../../components/ui/index'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../context/ToastContext'
import api from '../../lib/api'

const ALL_RESOURCES = [
  'invoices', 'expenses', 'bills', 'subscriptions', 'purchase-orders',
  'inventory', 'resources', 'forecasting', 'reports',
  'clients', 'users', 'roles', 'departments', 'businesses',
]
const ALL_ACTIONS = ['read', 'write', 'delete']

function PermMatrix({ permissions, onChange, readOnly }) {
  const hasWildcard = (permissions['*'] || []).includes('*')

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '5px 8px', color: 'var(--text-tertiary)', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>
              Resource
            </th>
            {ALL_ACTIONS.map(a => (
              <th key={a} style={{ padding: '5px 8px', color: 'var(--text-tertiary)', fontWeight: 500, borderBottom: '0.5px solid var(--border)', textAlign: 'center' }}>
                {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_RESOURCES.map(res => (
            <tr key={res}>
              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{res}</td>
              {ALL_ACTIONS.map(action => {
                const perms   = permissions[res] || []
                const checked = hasWildcard || perms.includes(action) || perms.includes('*')
                return (
                  <td key={action} style={{ textAlign: 'center', padding: '6px 8px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly || hasWildcard}
                      onChange={e => {
                        if (!onChange) return
                        const next = { ...permissions }
                        if (!next[res]) next[res] = []
                        if (e.target.checked) {
                          next[res] = [...new Set([...next[res], action])]
                        } else {
                          next[res] = next[res].filter(a => a !== action)
                          if (next[res].length === 0) delete next[res]
                        }
                        onChange(next)
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Roles() {
  const canWrite  = usePermission('roles', 'write')
  const canDelete = usePermission('roles', 'delete')
  const toast     = useToast()

  const [roles, setRoles]       = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newPerms, setNewPerms] = useState({})
  const [confirmDel, setConfirmDel] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/roles')
      setRoles(res.data)
      setSelected(prev => prev ? res.data.find(r => r.id === prev.id) ?? null : null)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function saveRole() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.put(`/roles/${selected.id}`, {
        name:        selected.name,
        permissions: selected.permissions,
      })
      setRoles(prev => prev.map(r => r.id === res.data.id ? res.data : r))
      setSelected(res.data)
      toast.success('Role updated')
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  async function createRole() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/roles', { name: newName.trim(), permissions: newPerms })
      setRoles(prev => [...prev, res.data])
      setSelected(res.data)
      setShowNew(false)
      setNewName('')
      setNewPerms({})
      toast.success(`Role "${res.data.name}" created`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRole(role) {
    try {
      await api.delete(`/roles/${role.id}`)
      setRoles(prev => prev.filter(r => r.id !== role.id))
      if (selected?.id === role.id) setSelected(null)
      toast.success(`Role "${role.name}" deleted`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to delete role')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <Topbar title="Roles" subtitle="Loading…" />
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Spinner size={24} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar title="Roles" subtitle={`${roles.length} roles`}
        actions={canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => { setNewName(''); setNewPerms({}); setShowNew(true) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New role
          </button>
        )}
      />

      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Role list */}
          <div className="card" style={{ padding: 8 }}>
            {roles.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 10px' }}>No roles yet.</p>
            )}
            {roles.map(r => (
              <button key={r.id}
                className="btn btn-ghost"
                style={{
                  width: '100%', justifyContent: 'flex-start', gap: 8, padding: '7px 10px',
                  background: selected?.id === r.id ? 'var(--blue-50)' : 'transparent',
                  color:      selected?.id === r.id ? 'var(--blue-800)' : 'var(--text-primary)',
                }}
                onClick={() => setSelected({ ...r })}
              >
                <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{r.name}</span>
                {r.is_system && <span className="pill pill-gray" style={{ fontSize: 9 }}>system</span>}
                {r.user_count > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.user_count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Permission editor */}
          {selected ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  {!selected.is_system && canWrite ? (
                    <input
                      className="input input-sm"
                      style={{ fontWeight: 500, fontSize: 15, width: 220 }}
                      value={selected.name}
                      onChange={e => setSelected(s => ({ ...s, name: e.target.value }))}
                    />
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{selected.name}</div>
                  )}
                  {selected.is_system && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      System role · {selected.user_count} users
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {canDelete && !selected.is_system && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                      onClick={() => setConfirmDel(selected)}>
                      Delete
                    </button>
                  )}
                  {canWrite && (
                    <button className="btn btn-primary btn-sm" onClick={saveRole} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  )}
                </div>
              </div>

              <PermMatrix
                permissions={selected.permissions}
                readOnly={!canWrite}
                onChange={perms => setSelected(s => ({ ...s, permissions: perms }))}
              />

              {(selected.permissions['*'] || []).includes('*') && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>
                  This role has wildcard access to all resources and actions.
                </p>
              )}
            </div>
          ) : (
            <div className="card">
              <EmptyState title="Select a role" message="Choose a role from the left to view or edit its permissions." />
            </div>
          )}
        </div>
      </div>

      {/* New role modal */}
      {showNew && (
        <Modal title="Create role" onClose={() => setShowNew(false)} width={640}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createRole} disabled={!newName.trim() || saving}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </>
          }
        >
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label">Role name</label>
            <input className="input" placeholder="e.g. finance-viewer" value={newName}
              onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="label" style={{ marginBottom: 8 }}>Permissions</div>
          <PermMatrix permissions={newPerms} onChange={setNewPerms} />
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <ConfirmModal
          title="Delete role"
          message={`Delete "${confirmDel.name}"? ${confirmDel.user_count > 0 ? `This will remove the role from ${confirmDel.user_count} user(s).` : ''}`}
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteRole(confirmDel)}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

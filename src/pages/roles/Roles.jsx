import { useState } from 'react'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, EmptyState } from '../../components/ui/index'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../context/ToastContext'
import { mockRoles } from '../../lib/mockData'

const ALL_RESOURCES = ['invoices','expenses','bills','subscriptions','purchase-orders','inventory','resources','forecasting','reports','users','roles','departments']
const ALL_ACTIONS   = ['read','write','delete']

function PermMatrix({ permissions, onChange, readOnly }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign:'left', padding:'5px 8px', color:'var(--text-tertiary)', fontWeight:500, borderBottom:'0.5px solid var(--border)' }}>Resource</th>
            {ALL_ACTIONS.map(a => (
              <th key={a} style={{ padding:'5px 8px', color:'var(--text-tertiary)', fontWeight:500, borderBottom:'0.5px solid var(--border)', textAlign:'center' }}>{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_RESOURCES.map(res => (
            <tr key={res}>
              <td style={{ padding:'6px 8px', color:'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:11 }}>{res}</td>
              {ALL_ACTIONS.map(action => {
                const perms   = permissions[res] || []
                const hasAll  = (permissions['*']||[]).includes('*')
                const checked = hasAll || perms.includes(action) || perms.includes('*')
                return (
                  <td key={action} style={{ textAlign:'center', padding:'6px 8px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly || hasAll}
                      onChange={e => {
                        if (!onChange) return
                        const next = { ...permissions }
                        if (!next[res]) next[res] = []
                        if (e.target.checked) {
                          next[res] = [...new Set([...next[res], action])]
                        } else {
                          next[res] = next[res].filter(a => a !== action)
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
  const canWrite               = usePermission('roles','write')
  const toast                  = useToast()
  const [roles, setRoles]      = useState(mockRoles)
  const [selected, setSelected]= useState(null)
  const [showNew, setShowNew]  = useState(false)
  const [newName, setNewName]  = useState('')
  const [newPerms, setNewPerms]= useState({})

  function saveRole() {
    if (!selected) return
    setRoles(prev => prev.map(r => r.id === selected.id ? selected : r))
    toast.success('Role updated')
  }

  function createRole() {
    const role = { id:`role-${Date.now()}`, name: newName, is_system: false, permissions: newPerms }
    setRoles(prev => [...prev, role])
    setShowNew(false)
    setNewName('')
    setNewPerms({})
    toast.success(`Role "${newName}" created`)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar title="Roles" subtitle={`${roles.length} roles`}
        actions={canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New role
          </button>
        )}
      />

      <div className="page">
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:16, alignItems:'start' }}>
          {/* Role list */}
          <div className="card" style={{ padding:8 }}>
            {roles.map(r => (
              <button key={r.id}
                className="btn btn-ghost"
                style={{ width:'100%', justifyContent:'flex-start', gap:8, padding:'7px 10px',
                  background: selected?.id === r.id ? 'var(--blue-50)' : 'transparent',
                  color: selected?.id === r.id ? 'var(--blue-800)' : 'var(--text-primary)' }}
                onClick={() => setSelected({ ...r })}
              >
                <span style={{ flex:1, textAlign:'left', fontSize:13 }}>{r.name}</span>
                {r.is_system && <span className="pill pill-gray" style={{ fontSize:9 }}>system</span>}
              </button>
            ))}
          </div>

          {/* Permission editor */}
          {selected ? (
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:500 }}>{selected.name}</div>
                  {selected.is_system && <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>System role — name is locked</div>}
                </div>
                {canWrite && !selected.is_system && (
                  <button className="btn btn-primary btn-sm" onClick={saveRole}>Save changes</button>
                )}
              </div>
              <PermMatrix
                permissions={selected.permissions}
                readOnly={!canWrite || selected.is_system}
                onChange={perms => setSelected(s => ({ ...s, permissions: perms }))}
              />
              {(selected.permissions['*']||[]).includes('*') && (
                <p style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:10 }}>
                  Admin role has wildcard access to all resources and actions.
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

      {showNew && (
        <Modal title="Create role" onClose={() => setShowNew(false)} footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createRole} disabled={!newName.trim()}>Create</button>
          </>
        } width={640}>
          <div className="field" style={{ marginBottom:14 }}>
            <label className="label">Role name</label>
            <input className="input" placeholder="e.g. finance-viewer" value={newName} onChange={e => setNewName(e.target.value)}/>
          </div>
          <div className="label" style={{ marginBottom:8 }}>Permissions</div>
          <PermMatrix permissions={newPerms} onChange={setNewPerms}/>
        </Modal>
      )}
    </div>
  )
}

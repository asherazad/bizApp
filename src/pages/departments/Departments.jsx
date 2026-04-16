import { useState } from 'react'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, ConfirmModal } from '../../components/ui/index'
import { usePermission } from '../../hooks/usePermission'
import { useToast } from '../../context/ToastContext'
import { mockDepartments } from '../../lib/mockData'

export default function Departments() {
  const canWrite               = usePermission('departments','write')
  const toast                  = useToast()
  const [depts, setDepts]      = useState(mockDepartments)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [form, setForm]             = useState({ name:'', code:'' })

  function openNew()    { setEditing(null); setForm({ name:'', code:'' }); setShowModal(true) }
  function openEdit(d)  { setEditing(d);    setForm({ name: d.name, code: d.code }); setShowModal(true) }

  function handleSave(e) {
    e.preventDefault()
    if (editing) {
      setDepts(prev => prev.map(d => d.id === editing.id ? { ...d, ...form } : d))
      toast.success('Department updated')
    } else {
      setDepts(prev => [...prev, { id:`dept-${Date.now()}`, tenant_id:'tenant-001', ...form }])
      toast.success(`Department "${form.name}" created`)
    }
    setShowModal(false)
  }

  function handleDelete(id) {
    setDepts(prev => prev.filter(d => d.id !== id))
    toast.success('Department deleted')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar title="Departments" subtitle={`${depts.length} departments`}
        actions={canWrite && (
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add department
          </button>
        )}
      />

      <div className="page">
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Code</th><th>Tenant</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {depts.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight:500 }}>{d.name}</td>
                  <td><span className="pill pill-blue" style={{ fontFamily:'var(--font-mono)' }}>{d.code}</span></td>
                  <td style={{ color:'var(--text-secondary)', fontSize:12 }}>{d.tenant_id}</td>
                  {canWrite && (
                    <td style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-600)' }} onClick={() => setConfirmDel(d)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit department' : 'Add department'} onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="dept-form" type="submit">{editing ? 'Save' : 'Create'}</button>
          </>
        }>
          <form id="dept-form" onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="field">
              <label className="label">Department name</label>
              <input className="input" required placeholder="e.g. Engineering" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}/>
            </div>
            <div className="field">
              <label className="label">Code <span style={{ color:'var(--text-tertiary)' }}>(short identifier)</span></label>
              <input className="input" required placeholder="e.g. ENG" maxLength={8} value={form.code}
                onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))}/>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmModal
          title="Delete department"
          message={`Are you sure you want to delete "${confirmDel.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(confirmDel.id)}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

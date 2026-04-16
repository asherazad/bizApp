import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/sidebar/Topbar'
import { Modal, Avatar, SearchInput, ConfirmModal, EmptyState } from '../../components/ui/index'
import { useToast } from '../../context/ToastContext'
import { useClients } from '../../lib/apiHooks'
import { formatDate, formatShort } from '../../lib/format'
import { CURRENCIES } from '../../lib/invoiceCalc'
import styles from './Clients.module.css'

// ─── Client form modal ────────────────────────────────────
function ClientModal({ client, onSave, onClose }) {
  const isEdit = !!client
  const [form, setForm] = useState({
    name:       client?.name       ?? '',
    email:      client?.email      ?? '',
    phone:      client?.phone      ?? '',
    address:    client?.address    ?? '',
    city:       client?.city       ?? '',
    country:    client?.country    ?? '',
    tax_number: client?.tax_number ?? '',
    currency:   client?.currency   ?? 'USD',
    notes:      client?.notes      ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title={isEdit ? `Edit ${client.name}` : 'New client'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="client-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create client'}
          </button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {error && (
          <div style={{ background:'var(--red-50)', color:'var(--red-600)', fontSize:12, padding:'8px 12px', borderRadius:'var(--r-md)' }}>
            {error}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="field" style={{ gridColumn:'1/-1' }}>
            <label className="label">Company / client name *</label>
            <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Trust ITC"/>
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="accounts@company.com"/>
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+971 56 523 0519"/>
          </div>
          <div className="field" style={{ gridColumn:'1/-1' }}>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, building, floor"/>
          </div>
          <div className="field">
            <label className="label">City</label>
            <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Dubai"/>
          </div>
          <div className="field">
            <label className="label">Country</label>
            <input className="input" value={form.country} onChange={e => set('country', e.target.value)} placeholder="AE"/>
          </div>
          <div className="field">
            <label className="label">Tax / VAT / NTN number</label>
            <input className="input" value={form.tax_number} onChange={e => set('tax_number', e.target.value)} placeholder="NTN-1234567"/>
          </div>
          <div className="field">
            <label className="label">Default currency</label>
            <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn:'1/-1' }}>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes about this client"/>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ─── Client row ───────────────────────────────────────────
function ClientRow({ client, onEdit, onDelete, onView }) {
  return (
    <tr className={styles.row} onClick={() => onView(client)}>
      <td>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Avatar name={client.name} size={30}/>
          <div>
            <div style={{ fontWeight:500, fontSize:13 }}>{client.name}</div>
            {client.tax_number && (
              <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>Tax: {client.tax_number}</div>
            )}
          </div>
        </div>
      </td>
      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
        {client.email && <div>{client.email}</div>}
        {client.phone && <div>{client.phone}</div>}
      </td>
      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
        {[client.city, client.country].filter(Boolean).join(', ') || '—'}
      </td>
      <td>
        <span className="pill pill-gray" style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>
          {client.currency}
        </span>
      </td>
      <td style={{ textAlign:'right', fontWeight:500, fontSize:13 }}>
        {client.invoice_count ?? 0}
      </td>
      <td onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(client)}>Edit</button>
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-600)' }} onClick={() => onDelete(client)}>Delete</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Client detail side panel ─────────────────────────────
function ClientPanel({ client, onClose, onEdit }) {
  const navigate = useNavigate()
  if (!client) return null

  const stats = client.stats ?? {}
  const outstanding = parseFloat(stats.total_outstanding ?? 0)
  const billed      = parseFloat(stats.total_billed ?? 0)

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Avatar name={client.name} size={40}/>
          <div>
            <div style={{ fontWeight:500, fontSize:15 }}>{client.name}</div>
            {client.email && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{client.email}</div>}
          </div>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Total billed</div>
            <div className={styles.statVal}>{formatShort(billed)}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Outstanding</div>
            <div className={styles.statVal} style={{ color: outstanding > 0 ? 'var(--red-600)' : 'var(--green-600)' }}>
              {formatShort(outstanding)}
            </div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Invoices</div>
            <div className={styles.statVal}>{stats.total_invoices ?? 0}</div>
          </div>
        </div>

        <div className={styles.detailGrid}>
          {client.phone      && <><span className={styles.detailKey}>Phone</span><span>{client.phone}</span></>}
          {client.address    && <><span className={styles.detailKey}>Address</span><span style={{ fontSize:12 }}>{client.address}{client.city ? `, ${client.city}` : ''}</span></>}
          {client.country    && <><span className={styles.detailKey}>Country</span><span>{client.country}</span></>}
          {client.tax_number && <><span className={styles.detailKey}>Tax no</span><span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{client.tax_number}</span></>}
          {client.notes      && <><span className={styles.detailKey}>Notes</span><span style={{ fontSize:12 }}>{client.notes}</span></>}
        </div>

        {client.invoices?.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:500, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', margin:'16px 0 8px' }}>
              Recent invoices
            </div>
            {client.invoices.slice(0,5).map(inv => (
              <div key={inv.id} className={styles.invRow} onClick={() => navigate(`/invoices/${inv.id}`)}>
                <div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--blue-600)' }}>{inv.number}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{formatDate(inv.issue_date)}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:500, fontSize:12 }}>{inv.currency} {parseFloat(inv.total).toLocaleString('en-US',{minimumFractionDigits:2})}</span>
                  <span className={`pill pill-${inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : inv.status === 'draft' ? 'gray' : 'blue'}`} style={{ fontSize:10 }}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop:16, display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={() => onEdit(client)}>
            Edit client
          </button>
          <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => navigate('/invoices/upload')}>
            Upload invoice
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────
export default function Clients() {
  const toast    = useToast()
  const navigate = useNavigate()
  const [search,  setSearch]  = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting,setDeleting]= useState(null)
  const [selected,setSelected]= useState(null)

  const { clients, loading, error, refetch, createClient, updateClient, deleteClient } = useClients(search)

  async function handleCreate(data) {
    const c = await createClient(data)
    toast.success(`${c.name} created`)
  }

  async function handleUpdate(data) {
    const c = await updateClient(editing.id, data)
    toast.success(`${c.name} updated`)
    if (selected?.id === c.id) setSelected(c)
  }

  async function handleDelete(client) {
    try {
      await deleteClient(client.id)
      toast.success(`${client.name} archived`)
      if (selected?.id === client.id) setSelected(null)
    } catch (err) {
      toast.error(err.response?.data?.error ?? err.message)
    }
    setDeleting(null)
  }

  async function handleView(client) {
    // Load full client with stats + invoices
    try {
      const res = await import('../../lib/api').then(m => m.default.get(`/clients/${client.id}`))
      setSelected(res.data)
    } catch {
      setSelected(client)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New client
          </button>
        }
      />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'auto' }}>
          <div className="page">
            <SearchInput value={search} onChange={setSearch} placeholder="Search clients…" style={{ width:280 }}/>

            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="table-wrap">
                {loading ? (
                  <div style={{ padding:40, textAlign:'center' }}>
                    <div className="spinner" style={{ margin:'0 auto' }}/>
                  </div>
                ) : error ? (
                  <div style={{ padding:24, color:'var(--red-600)', fontSize:13 }}>
                    Backend not connected — showing mock state. Start the server to load real data.
                  </div>
                ) : clients.length === 0 ? (
                  <EmptyState
                    title="No clients yet"
                    message="Add your first client or upload an invoice PDF — clients can be created during upload."
                    action={<button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>Add client</button>}
                  />
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Contact</th>
                        <th>Location</th>
                        <th>Currency</th>
                        <th style={{ textAlign:'right' }}>Invoices</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <ClientRow
                          key={c.id} client={c}
                          onEdit={c => { setEditing(c); }}
                          onDelete={c => setDeleting(c)}
                          onView={handleView}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Side panel */}
        {selected && (
          <ClientPanel
            client={selected}
            onClose={() => setSelected(null)}
            onEdit={c => { setEditing(c); }}
          />
        )}
      </div>

      {/* Modals */}
      {showNew  && <ClientModal onSave={handleCreate} onClose={() => setShowNew(false)}/>}
      {editing  && <ClientModal client={editing} onSave={handleUpdate} onClose={() => setEditing(null)}/>}
      {deleting && (
        <ConfirmModal
          title="Archive client"
          message={`Archive ${deleting.name}? They won't appear in future invoice lists. This can be undone by an admin.`}
          confirmLabel="Archive"
          danger
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

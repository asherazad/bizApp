import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { Plus, Pencil, Users2 } from 'lucide-react';

function ClientModal({ client, wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    wing_id: client?.wing_id || '', name: client?.name || '',
    email: client?.email || '', phone: client?.phone || '',
    address: client?.address || '', ntn: client?.ntn || '',
    strn: client?.strn || '', type: client?.type || 'client',
  });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (client) await api.put(`/clients/${client.id}`, form);
      else        await api.post('/clients', form);
      toast(client ? 'Updated' : 'Created', 'success'); onSaved();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>{client ? 'Edit' : 'New'} Client / Vendor</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}>
                  <option value="">Select…</option>
                  {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-control" value={form.type} onChange={f('type')}>
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={f('name')} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={f('email')} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={f('phone')} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">NTN</label><input className="form-control" value={form.ntn} onChange={f('ntn')} /></div>
              <div className="form-group"><label className="form-label">STRN</label><input className="form-control" value={form.strn} onChange={f('strn')} /></div>
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

export default function Clients() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [modal, setModal]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');

  async function load() {
    setLoading(true);
    const params = {};
    if (activeWing?.id) params.wing_id = activeWing.id;
    try { setClients((await api.get('/clients', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing]);

  const filtered = clients.filter((c) => !filter || c.type === filter);

  return (
    <div>
      <div className="page-header">
        <h1>Clients & Vendors</h1>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15}/> New</button>
      </div>

      <div className="flex gap-2 mb-4">
        {['','client','vendor','both'].map((t) => (
          <button key={t} className={`btn btn-sm ${filter === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(t)}>
            {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Email</th><th>Phone</th><th>NTN</th><th></th></tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><Users2 size={28} style={{ opacity: .3, display: 'block', margin: '0 auto 8px' }} />No records</td></tr>
                  : filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td><span className={`badge ${c.type === 'client' ? 'badge-info' : c.type === 'vendor' ? 'badge-warning' : 'badge-neutral'}`}>{c.type}</span></td>
                      <td className="text-muted">{c.email || '—'}</td>
                      <td className="text-muted">{c.phone || '—'}</td>
                      <td className="text-muted">{c.ntn || '—'}</td>
                      <td><button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(c)}><Pencil size={13}/></button></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <ClientModal client={modal?.id ? modal : null} wings={wings} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

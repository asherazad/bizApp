import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatDateTime, formatStatus } from '../../lib/format';
import { Plus, Bell, CheckCircle } from 'lucide-react';

function ReminderModal({ wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: '', title: '', description: '', due_at: '', category: 'general', priority: 'medium' });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.post('/reminders', form); toast('Reminder set', 'success'); onSaved(); }
    catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>New Reminder</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label className="form-label">Title *</label><input className="form-control" required value={form.title} onChange={f('title')} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Due At *</label><input type="datetime-local" className="form-control" required value={form.due_at} onChange={f('due_at')} /></div>
              <div className="form-group"><label className="form-label">Wing</label>
                <select className="form-control" value={form.wing_id} onChange={f('wing_id')}><option value="">All wings</option>{wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Category</label>
                <select className="form-control" value={form.category} onChange={f('category')}>
                  {['tax','compliance','payment','contract','general'].map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Priority</label>
                <select className="form-control" value={form.priority} onChange={f('priority')}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.description} onChange={f('description')} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Set Reminder'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Reminders() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [reminders, setReminders] = useState([]);
  const [modal, setModal]         = useState(false);
  const [showDone, setShowDone]   = useState(false);
  const [loading, setLoading]     = useState(true);

  async function load() {
    setLoading(true);
    const params = {};
    if (activeWing?.id) params.wing_id = activeWing.id;
    if (!showDone) params.is_completed = 'false';
    try { setReminders((await api.get('/reminders', { params })).data); }
    catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing, showDone]);

  async function complete(id) {
    try { await api.put(`/reminders/${id}`, { is_completed: true }); toast('Marked complete', 'success'); load(); }
    catch { toast('Error', 'error'); }
  }

  const priorityColor = { high: 'badge-danger', medium: 'badge-warning', low: 'badge-neutral' };

  return (
    <div>
      <div className="page-header">
        <h1>Reminders</h1>
        <div className="flex gap-2">
          <button className={`btn btn-sm ${showDone ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowDone((p) => !p)}>
            {showDone ? 'Hide Completed' : 'Show Completed'}
          </button>
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> New Reminder</button>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Title</th><th>Category</th><th>Priority</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : reminders.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><Bell size={28} style={{ opacity: .3, display: 'block', margin: '0 auto 8px' }}/>No reminders</td></tr>
                : reminders.map((r) => (
                  <tr key={r.id} style={{ opacity: r.is_completed ? .5 : 1 }}>
                    <td style={{ fontWeight: 500 }}>{r.title}</td>
                    <td><span className="badge badge-neutral">{r.category}</span></td>
                    <td><span className={`badge ${priorityColor[r.priority]}`}>{r.priority}</span></td>
                    <td className="text-muted">{formatDateTime(r.due_at)}</td>
                    <td><span className={`badge ${r.is_completed ? 'badge-neutral' : 'badge-warning'}`}>{r.is_completed ? 'Done' : 'Pending'}</span></td>
                    <td>{!r.is_completed && <button className="btn btn-secondary btn-sm btn-icon" title="Mark complete" onClick={() => complete(r.id)}><CheckCircle size={13}/></button>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <ReminderModal wings={wings} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

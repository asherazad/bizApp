import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';
import InvoiceSearch from './InvoiceSearch';
import { UserCircle2, X } from 'lucide-react';

function ProfileModal({ user, onClose, updateUser }) {
  const toast = useToast();
  const [tab, setTab]   = useState('profile'); // 'profile' | 'password'
  const [form, setForm] = useState({ full_name: user?.name || '', email: user?.email || '' });
  const [pw, setPw]     = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving]   = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  function f(k)  { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  function p(k)  { return (e) => setPw((prev) => ({ ...prev, [k]: e.target.value })); }

  async function saveProfile(e) {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', form);
      updateUser({ name: data.name || data.full_name, email: data.email });
      toast('Profile updated', 'success');
      onClose();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pw.new_password !== pw.confirm_password) { toast('Passwords do not match', 'error'); return; }
    if (pw.new_password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { current_password: pw.current_password, new_password: pw.new_password });
      toast('Password changed', 'success');
      setPw({ current_password: '', new_password: '', confirm_password: '' });
      onClose();
    } catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSavingPw(false); }
  }

  const tabStyle = (t) => ({
    padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
    borderBottom: tab === t ? '2px solid var(--navy)' : '2px solid transparent',
    color: tab === t ? 'var(--navy)' : 'var(--text-muted)',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>My Profile</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          <div style={tabStyle('profile')} onClick={() => setTab('profile')}>Profile</div>
          <div style={tabStyle('password')} onClick={() => setTab('password')}>Change Password</div>
        </div>

        {tab === 'profile' && (
          <form onSubmit={saveProfile}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" required value={form.full_name} onChange={f('full_name')} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-control" required value={form.email} onChange={f('email')} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}

        {tab === 'password' && (
          <form onSubmit={savePassword}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <input type="password" className="form-control" required value={pw.current_password} onChange={p('current_password')} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input type="password" className="form-control" required minLength={8} value={pw.new_password} onChange={p('new_password')} placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input type="password" className="form-control" required minLength={8} value={pw.confirm_password} onChange={p('confirm_password')} />
              </div>
              {pw.new_password && pw.confirm_password && pw.new_password !== pw.confirm_password && (
                <div style={{ fontSize: 12, color: 'var(--danger)' }}>Passwords do not match</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingPw || (pw.new_password !== pw.confirm_password)}>{savingPw ? 'Updating…' : 'Update Password'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Topbar({ title }) {
  const { user, wings, activeWing, setActiveWing, updateUser } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      <header className="topbar">
        <span className="topbar-title">{title}</span>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
          <InvoiceSearch wings={wings} />
        </div>

        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {wings.length > 1 ? (
            <select className="wing-selector" value={activeWing?.id || ''} onChange={(e) => setActiveWing(wings.find((w) => w.id === e.target.value) || null)}>
              <option value="">All Wings</option>
              {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          ) : wings.length === 1 ? (
            <div style={{ height: 32, padding: '0 12px', background: 'var(--electric-light)', border: '1px solid var(--electric-ring)', borderRadius: 'var(--r)', fontSize: 12.5, fontWeight: 600, color: 'var(--electric)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block' }} />
              {wings[0].name}
            </div>
          ) : null}

          {/* Profile button */}
          <button
            onClick={() => setShowProfile(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}
          >
            <UserCircle2 size={16} />
            {user?.name || 'Profile'}
          </button>
        </div>
      </header>

      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} updateUser={updateUser} />}
    </>
  );
}

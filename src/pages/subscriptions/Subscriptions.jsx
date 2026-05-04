import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, formatStatus, statusBadgeClass } from '../../lib/format';
import { Plus, Pencil, Trash2, CreditCard, Pause, Play } from 'lucide-react';

const CYCLES = [
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'semi_annual',label: 'Semi-Annual' },
  { value: 'yearly',     label: 'Yearly' },
  { value: 'once',       label: 'One-time' },
];

function cycleLabel(c) { return CYCLES.find(x => x.value === c)?.label || formatStatus(c || ''); }

function isDue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) <= new Date(Date.now() + 7 * 86400000);
}

// ─── Sub modal ────────────────────────────────────────────────────────────────
function SubModal({ sub, wings, onClose, onSaved }) {
  const toast  = useToast();
  const isEdit = !!sub?.id;
  const [form, setForm] = useState({
    wing_id:           sub?.wing_id           || '',
    service_name:      sub?.service_name      || '',
    amount:            sub?.amount            || '',
    currency_code:     sub?.currency_code     || 'PKR',
    billing_cycle:     sub?.billing_cycle     || 'monthly',
    next_billing_date: sub?.next_billing_date?.split('T')[0] || '',
    vendor_url:        sub?.vendor_url        || '',
    notes:             sub?.notes             || '',
    status:            sub?.status            || 'active',
  });
  const [saving, setSaving] = useState(false);
  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) await api.put(`/subscriptions/${sub.id}`, form);
      else        await api.post('/subscriptions', form);
      toast(isEdit ? 'Updated' : 'Subscription added', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit' : 'New'} Subscription</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Business Wing *</label>
                <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}>
                  <option value="">Select wing…</option>
                  {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Service Name *</label>
                <input className="form-control" required placeholder="AWS, GitHub, Slack…" value={form.service_name} onChange={f('service_name')} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>
                  {['PKR','USD','EUR','AED','GBP'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Billing Cycle *</label>
                <select className="form-control" value={form.billing_cycle} onChange={f('billing_cycle')}>
                  {CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Next Due Date *</label>
                <input type="date" className="form-control" required value={form.next_billing_date} onChange={f('next_billing_date')} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Vendor URL</label>
              <input className="form-control" placeholder="https://…" value={form.vendor_url} onChange={f('vendor_url')} />
            </div>

            {isEdit && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={f('status')}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={f('notes')} />
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

// ─── Pay modal ────────────────────────────────────────────────────────────────
function PayModal({ sub, ccBalance, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    paid_amount: sub.amount || '',
    paid_date:   new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  const total    = parseFloat(form.paid_amount) || 0;
  const enough   = ccBalance >= total;

  async function submit(e) {
    e.preventDefault();
    if (!enough) return toast('Insufficient credit card balance', 'error');
    setSaving(true);
    try {
      await api.post(`/subscriptions/${sub.id}/pay`, form);
      toast('Payment recorded — CC balance updated', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Pay Subscription</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600 }}>{sub.service_name}</div>
              <div className="text-muted">{sub.wing_name} · {cycleLabel(sub.billing_cycle)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="text-muted">Subscription amount</span>
                <span className="font-mono">{formatCurrency(sub.amount, sub.currency_code)}</span>
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: enough ? 'var(--bg-secondary)' : 'var(--danger-light)',
              border: `1px solid ${enough ? 'var(--border)' : 'var(--danger-border)'}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>CC Balance</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>{formatCurrency(ccBalance)}</span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Actual Amount Paid (PKR) *</label>
              <input type="number" step="0.01" className="form-control" required
                value={form.paid_amount}
                onChange={e => setForm(p => ({ ...p, paid_amount: e.target.value }))} />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Payment Date *</label>
              <input type="date" className="form-control" required value={form.paid_date}
                onChange={e => setForm(p => ({ ...p, paid_date: e.target.value }))} />
            </div>

            {total > 0 && (
              <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                <strong>{formatCurrency(total)}</strong> will be debited from the credit card.
                {enough && <> New balance: <strong>{formatCurrency(ccBalance - total)}</strong></>}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !enough}>
              {saving ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Recharge CC modal ────────────────────────────────────────────────────────
function RechargeModal({ wings, ccBalance, onClose, onSaved }) {
  const toast = useToast();
  const [wingId, setWingId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [form, setForm] = useState({ bank_account_id: '', amount: '', recharge_date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (wingId) {
      api.get('/banks/accounts', { params: { wing_id: wingId } })
        .then(r => setBankAccounts(r.data))
        .catch(() => {});
    } else { setBankAccounts([]); }
  }, [wingId]);

  const selectedAcc = bankAccounts.find(a => String(a.id) === String(form.bank_account_id));

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/creditcard/recharge', form);
      toast('CC recharged — bank account debited', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Recharge Credit Card</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <span className="text-muted">Current CC Balance</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>{formatCurrency(ccBalance)}</span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Business Wing *</label>
              <select className="form-control" required value={wingId} onChange={e => { setWingId(e.target.value); setForm(p => ({ ...p, bank_account_id: '' })); }}>
                <option value="">Select wing…</option>
                {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Bank Account *</label>
              <select className="form-control" required value={form.bank_account_id}
                onChange={e => setForm(p => ({ ...p, bank_account_id: e.target.value }))}
                disabled={!wingId}>
                <option value="">— Select account —</option>
                {bankAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name} — {a.account_title} ({formatCurrency(a.current_balance, a.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Amount (PKR) *</label>
              <input type="number" step="0.01" className="form-control" required value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date *</label>
              <input type="date" className="form-control" required value={form.recharge_date}
                onChange={e => setForm(p => ({ ...p, recharge_date: e.target.value }))} />
            </div>

            {parseFloat(form.amount) > 0 && selectedAcc && (
              <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                <strong>{formatCurrency(form.amount)}</strong> will be debited from{' '}
                <strong>{selectedAcc.bank_name}</strong> and credited to the credit card.
                New CC balance: <strong>{formatCurrency(ccBalance + (parseFloat(form.amount) || 0))}</strong>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Processing…' : 'Recharge'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Subscriptions() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();

  const [subs, setSubs]             = useState([]);
  const [ccBalance, setCCBalance]   = useState(0);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [payTarget, setPayTarget]   = useState(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  async function load() {
    setLoading(true);
    const params = {};
    if (activeWing?.id) params.wing_id = activeWing.id;
    if (filterStatus)   params.status  = filterStatus;
    try {
      const [subsRes, ccRes] = await Promise.all([
        api.get('/subscriptions', { params }),
        api.get('/creditcard/balance').catch(() => ({ data: { current_balance: 0 } })),
      ]);
      setSubs(subsRes.data);
      setCCBalance(parseFloat(ccRes.data.current_balance) || 0);
    } catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [activeWing, filterStatus]);

  async function toggleStatus(sub) {
    const next = sub.status === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/subscriptions/${sub.id}`, { status: next });
      toast(`Subscription ${next}`, 'success');
      load();
    } catch { toast('Error', 'error'); }
  }

  async function deleteSub(id) {
    try {
      await api.delete(`/subscriptions/${id}`);
      toast('Deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch { toast('Error deleting', 'error'); }
  }

  // summary stats
  const activeSubs = subs.filter(s => s.status === 'active');
  const totalMonthly = activeSubs.reduce((acc, s) => {
    const amt = parseFloat(s.amount) || 0;
    if (s.billing_cycle === 'yearly' || s.billing_cycle === 'annual') return acc + amt / 12;
    if (s.billing_cycle === 'quarterly') return acc + amt / 3;
    if (s.billing_cycle === 'semi_annual') return acc + amt / 6;
    if (s.billing_cycle === 'once') return acc;
    return acc + amt;
  }, 0);
  const upcoming = subs.filter(s => s.status === 'active' && isDue(s.next_billing_date));

  return (
    <div>
      <div className="page-header">
        <h1>Subscriptions</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setRechargeOpen(true)}>
            <CreditCard size={15}/> Recharge CC
          </button>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Plus size={15}/> New Subscription
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 6 }}>CC Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ccBalance < 5000 ? 'var(--danger)' : 'inherit' }}>{formatCurrency(ccBalance)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Available to spend</div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 6 }}>Monthly Cost</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(totalMonthly)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{activeSubs.length} active subscription{activeSubs.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 6 }}>Due Soon</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: upcoming.length > 0 ? 'var(--warning)' : 'inherit' }}>{upcoming.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Due within 7 days</div>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <select className="form-control" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Active</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th><th>Wing</th><th>Cycle</th>
                <th className="text-right">Amount</th>
                <th>Next Due</th><th>Last Paid</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                : subs.length === 0
                  ? <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No subscriptions</td></tr>
                  : subs.map(s => {
                    const due = isDue(s.next_billing_date) && s.status === 'active';
                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{s.service_name}</div>
                          {s.vendor_url && <a href={s.vendor_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.vendor_url.replace(/^https?:\/\//, '')}</a>}
                        </td>
                        <td className="text-muted" style={{ fontSize: 12 }}>{s.wing_name || '—'}</td>
                        <td className="text-muted">{cycleLabel(s.billing_cycle)}</td>
                        <td className="text-right font-mono" style={{ fontWeight: 600 }}>{formatCurrency(s.amount, s.currency_code)}</td>
                        <td style={{ color: due ? 'var(--danger)' : undefined, fontWeight: due ? 600 : undefined }}>
                          {formatDate(s.next_billing_date)}
                          {due && <span style={{ fontSize: 10, marginLeft: 4, background: 'var(--danger)', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>DUE</span>}
                        </td>
                        <td className="text-muted" style={{ fontSize: 12 }}>
                          {s.last_paid_date ? <>{formatDate(s.last_paid_date)}<br/><span className="font-mono">{formatCurrency(s.last_paid_amount)}</span></> : '—'}
                        </td>
                        <td>
                          <span className={`badge ${s.status === 'active' ? 'badge-success' : s.status === 'paused' ? 'badge-warning' : 'badge-neutral'}`}>
                            {formatStatus(s.status)}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          {s.status === 'active' && (
                            <button className="btn btn-primary btn-sm btn-icon" title="Pay via CC" onClick={() => setPayTarget(s)}>
                              <CreditCard size={13}/>
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm btn-icon" title={s.status === 'active' ? 'Pause' : 'Activate'} onClick={() => toggleStatus(s)}>
                            {s.status === 'active' ? <Pause size={13}/> : <Play size={13}/>}
                          </button>
                          <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => setModal(s)}>
                            <Pencil size={13}/>
                          </button>
                          <button className="btn btn-secondary btn-sm btn-icon" style={{ color: 'var(--danger)' }} title="Delete" onClick={() => setDeleteTarget(s)}>
                            <Trash2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal !== null && (
        <SubModal
          sub={modal?.id ? modal : null}
          wings={wings}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {payTarget && (
        <PayModal
          sub={payTarget}
          ccBalance={ccBalance}
          onClose={() => setPayTarget(null)}
          onSaved={() => { setPayTarget(null); load(); }}
        />
      )}

      {rechargeOpen && (
        <RechargeModal
          wings={wings}
          ccBalance={ccBalance}
          onClose={() => setRechargeOpen(false)}
          onSaved={() => { setRechargeOpen(false); load(); }}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Subscription</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete <strong>{deleteTarget.service_name}</strong>?</p>
              <p className="text-muted" style={{ fontSize: 13 }}>This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteSub(deleteTarget.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

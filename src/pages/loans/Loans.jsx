import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Plus, X, History, DollarSign, CheckCircle, Trash2 } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  const v = parseFloat(n) || 0;
  return 'PKR ' + v.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, ((max - value) / max) * 100) : 0;
  return (
    <div style={{ background: 'var(--border)', borderRadius: 4, height: 5, width: 80, overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: 4, transition: 'width .3s' }} />
    </div>
  );
}

// ─── Add Loan Modal ───────────────────────────────────────────────────────────
function AddLoanModal({ onClose, onSaved, toast }) {
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState({
    resource_id: '', loan_type: 'loan',
    amount: '', issued_date: new Date().toISOString().split('T')[0],
    monthly_installment: '', purpose: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/resources').then(r => setResources(r.data)).catch(() => {});
  }, []);

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/loans', {
        ...form,
        amount:              parseFloat(form.amount)              || 0,
        monthly_installment: parseFloat(form.monthly_installment) || 0,
      });
      toast(`${form.loan_type === 'advance' ? 'Advance' : 'Loan'} created successfully`, 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.detail || err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>New Loan / Advance</h3>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Resource *</label>
              <select className="form-control" required value={form.resource_id} onChange={f('resource_id')}>
                <option value="">Select resource…</option>
                {resources.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-control" value={form.loan_type} onChange={f('loan_type')}>
                <option value="loan">Loan</option>
                <option value="advance">Salary Advance</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (PKR) *</label>
              <input type="number" className="form-control" required min={1} value={form.amount} onChange={f('amount')} placeholder="e.g. 50000" />
            </div>
            <div className="form-group">
              <label className="form-label">Issue Date *</label>
              <input type="date" className="form-control" required value={form.issued_date} onChange={f('issued_date')} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Monthly Deduction (PKR)</label>
              <input type="number" className="form-control" value={form.monthly_installment} onChange={f('monthly_installment')} placeholder="0 = deduct manually each time" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Purpose / Notes</label>
              <input className="form-control" value={form.purpose} onChange={f('purpose')} placeholder="Medical, Home renovation…" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────
function RepayModal({ loan, onClose, onSaved, toast }) {
  const suggested = parseFloat(loan.monthly_installment) || '';
  const [form, setForm] = useState({
    amount: suggested,
    repayment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post(`/loans/${loan.id}/repay`, {
        amount:         parseFloat(form.amount),
        repayment_date: form.repayment_date,
        notes:          form.notes || null,
      });
      toast(data.message, 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.detail || err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }

  const remaining = parseFloat(loan.remaining_balance) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>Record Payment</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {loan.resource_name} · Remaining: <strong>{fmt(remaining)}</strong>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: '16px 20px' }}>
          <div className="form-group">
            <label className="form-label">Amount Deducted (PKR) *</label>
            <input type="number" className="form-control" required min={1} max={remaining} value={form.amount} onChange={f('amount')} />
            {loan.monthly_installment > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Suggested monthly deduction: {fmt(loan.monthly_installment)}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input type="date" className="form-control" required value={form.repayment_date} onChange={f('repayment_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-control" value={form.notes} onChange={f('notes')} placeholder="e.g. April payroll deduction" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Repayment History Modal ──────────────────────────────────────────────────
function HistoryModal({ loan, onClose }) {
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api.get(`/loans/${loan.id}/repayments`)
      .then(r => setRepayments(r.data))
      .finally(() => setLoading(false));
  }, [loan.id]);

  const total = repayments.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>Repayment History</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {loan.resource_name} · {loan.loan_type === 'advance' ? 'Advance' : 'Loan'} of {fmt(loan.amount)}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{ padding: '0 0 16px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: 24 }} className="text-muted">Loading…</p>
          ) : repayments.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 24 }} className="text-muted">No repayments recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {repayments.map(r => (
                    <tr key={r.id}>
                      <td className="text-muted">{formatDate(r.repayment_date)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{fmt(r.amount)}</td>
                      <td className="text-muted">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td style={{ fontWeight: 700, fontSize: 12 }}>Total Recovered</td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmt(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Loans() {
  const { activeWing } = useAuth();
  const toast = useToast();
  const [loans,    setLoans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('active'); // active | settled | all
  const [addOpen,  setAddOpen]  = useState(false);
  const [repay,    setRepay]    = useState(null);
  const [history,  setHistory]  = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = {
        ...(filter !== 'all' ? { status: filter } : {}),
      };
      const { data } = await api.get('/loans', { params });
      setLoans(data);
    } catch { toast('Failed to load loans', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [activeWing, filter]);

  async function deleteLoan(loan) {
    if (!confirm(`Delete this ${loan.loan_type} for ${loan.resource_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/loans/${loan.id}`);
      toast('Deleted', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Cannot delete', 'error');
    }
  }

  // Summary stats
  const activeLoans    = loans.filter(l => l.status === 'active');
  const totalIssued    = loans.reduce((s, l) => s + parseFloat(l.amount || 0), 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + parseFloat(l.remaining_balance || 0), 0);
  const totalRecovered = loans.reduce((s, l) => s + parseFloat(l.total_repaid || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Loans & Advances</h1>
        {activeWing && <span className="badge badge-navy">{activeWing.name}</span>}
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> New Loan / Advance
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card electric">
          <div className="stat-label">Active Loans</div>
          <div className="stat-value">{activeLoans.length}</div>
          <div className="stat-sub">currently open</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalOutstanding)}</div>
          <div className="stat-sub">yet to recover</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Total Recovered</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalRecovered)}</div>
          <div className="stat-sub">all time</div>
        </div>
        <div className="stat-card lime">
          <div className="stat-label">Total Issued</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalIssued)}</div>
          <div className="stat-sub">all time</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {[['active','Active'],['settled','Settled'],['all','All']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '7px 16px', fontSize: 12, fontWeight: filter === v ? 600 : 400,
            color: filter === v ? 'var(--primary)' : 'var(--text-muted)',
            background: 'none', border: 'none',
            borderBottom: filter === v ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1,
          }}>{l}</button>
        ))}
        <span className="text-muted" style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, paddingRight: 4 }}>
          {loans.length} record{loans.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Type</th>
                <th>Issue Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Monthly Deduction</th>
                <th style={{ textAlign: 'right' }}>Recovered</th>
                <th>Remaining</th>
                <th>Status</th>
                <th style={{ width: 110 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }} className="text-muted">Loading…</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }} className="text-muted">
                  No loans found. Click <strong>New Loan / Advance</strong> to get started.
                </td></tr>
              ) : loans.map(loan => {
                const remaining = parseFloat(loan.remaining_balance) || 0;
                const amount    = parseFloat(loan.amount) || 0;
                const repaid    = parseFloat(loan.total_repaid) || 0;
                const isActive  = loan.status === 'active';
                return (
                  <tr key={loan.id}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{loan.resource_name}</td>
                    <td>
                      <span className={`badge ${loan.loan_type === 'advance' ? 'badge-info' : 'badge-navy'}`} style={{ fontSize: 10 }}>
                        {loan.loan_type === 'advance' ? 'Advance' : 'Loan'}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(loan.issued_date)}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(amount)}</td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {loan.monthly_installment > 0 ? fmt(loan.monthly_installment) : '—'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{fmt(repaid)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="font-mono" style={{ fontWeight: 600, color: remaining > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          {fmt(remaining)}
                        </span>
                        <ProgressBar value={remaining} max={amount} />
                      </div>
                      {loan.purpose && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{loan.purpose}</div>}
                    </td>
                    <td>
                      <span className={`badge ${loan.status === 'active' ? 'badge-warning' : loan.status === 'settled' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                        {loan.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {isActive && (
                          <button
                            className="btn btn-primary btn-sm"
                            title="Record Payment"
                            onClick={() => setRepay(loan)}
                            style={{ fontSize: 10, padding: '3px 8px' }}
                          >
                            <DollarSign size={11} /> Pay
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm btn-icon"
                          title="Repayment History"
                          onClick={() => setHistory(loan)}
                        >
                          <History size={12} />
                        </button>
                        {!isActive && (
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Delete"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => deleteLoan(loan)}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <AddLoanModal
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
          toast={toast}
        />
      )}
      {repay && (
        <RepayModal
          loan={repay}
          onClose={() => setRepay(null)}
          onSaved={() => { setRepay(null); load(); }}
          toast={toast}
        />
      )}
      {history && (
        <HistoryModal loan={history} onClose={() => setHistory(null)} />
      )}
    </div>
  );
}

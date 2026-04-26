import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { Plus, Landmark, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

function AccountModal({ onClose, onSaved, wings }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: '', bank_name: '', account_number: '', account_title: '', branch: '', currency_code: 'PKR', opening_balance: '' });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.post('/banks/accounts', form); toast('Account added', 'success'); onSaved(); }
    catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Add Bank Account</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Business Wing *</label>
              <select className="form-control" required value={form.wing_id} onChange={f('wing_id')}>
                <option value="">Select wing…</option>
                {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Bank Name *</label><input className="form-control" required value={form.bank_name} onChange={f('bank_name')} /></div>
              <div className="form-group"><label className="form-label">Account Number *</label><input className="form-control" required value={form.account_number} onChange={f('account_number')} /></div>
            </div>
            <div className="form-group"><label className="form-label">Account Title *</label><input className="form-control" required value={form.account_title} onChange={f('account_title')} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>
                  {['PKR','USD','EUR','AED','GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Opening Balance</label><input type="number" className="form-control" value={form.opening_balance} onChange={f('opening_balance')} /></div>
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

function TxnModal({ account, wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ wing_id: account?.wing_id || '', bank_account_id: account?.id || '', type: 'credit', amount: '', currency_code: account?.currency_code || 'PKR', exchange_rate: '1', description: '', category: '', transaction_date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.post('/banks/transactions', form); toast('Transaction recorded', 'success'); onSaved(); }
    catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Add Transaction</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Type *</label>
                <select className="form-control" value={form.type} onChange={f('type')}>
                  <option value="credit">Credit (In)</option>
                  <option value="debit">Debit (Out)</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-control" required value={form.transaction_date} onChange={f('transaction_date')} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Amount *</label><input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} /></div>
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency_code} onChange={f('currency_code')}>
                  {['PKR','USD','EUR','AED','GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {form.currency_code !== 'PKR' && (
              <div className="form-group"><label className="form-label">Exchange Rate (to PKR)</label><input type="number" step="0.0001" className="form-control" value={form.exchange_rate} onChange={f('exchange_rate')} /></div>
            )}
            <div className="form-group"><label className="form-label">Description *</label><input className="form-control" required value={form.description} onChange={f('description')} /></div>
            <div className="form-group"><label className="form-label">Category</label><input className="form-control" placeholder="e.g. Client Payment, Utility, Salary" value={form.category} onChange={f('category')} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Banks() {
  const { activeWing, wings } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [modal, setModal]           = useState(null);
  const [txnModal, setTxnModal]     = useState(false);
  const [loading, setLoading]       = useState(true);

  async function loadAccounts() {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try { const r = await api.get('/banks/accounts', { params }); setAccounts(r.data); if (r.data.length) setSelected(r.data[0]); }
    catch { toast('Failed to load accounts', 'error'); }
    finally { setLoading(false); }
  }

  async function loadTxns(accountId) {
    if (!accountId) return;
    try { setTransactions((await api.get('/banks/transactions', { params: { bank_account_id: accountId } })).data); }
    catch { toast('Failed to load transactions', 'error'); }
  }

  useEffect(() => { loadAccounts(); }, [activeWing]);
  useEffect(() => { if (selected) loadTxns(selected.id); }, [selected]);

  return (
    <div>
      <div className="page-header">
        <h1>Bank Accounts</h1>
        <div className="flex gap-2">
          {selected && <button className="btn btn-secondary" onClick={() => setTxnModal(true)}><Plus size={15} /> Add Transaction</button>}
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Add Account</button>
        </div>
      </div>

      {/* Account cards */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        {accounts.map((a) => (
          <div key={a.id} onClick={() => setSelected(a)} style={{ cursor: 'pointer', minWidth: 200 }}
            className={`card ${selected?.id === a.id ? 'border-navy' : ''}`}
            style={{ padding: 16, cursor: 'pointer', border: selected?.id === a.id ? '2px solid var(--navy)' : undefined, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{a.wing_name}</div>
            <div style={{ fontWeight: 600 }}>{a.bank_name}</div>
            <div className="text-muted">{a.account_title}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', marginTop: 6 }}>
              {formatCurrency(a.current_balance, a.currency_code)}
            </div>
          </div>
        ))}
        {!loading && accounts.length === 0 && (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>No bank accounts found.</div>
        )}
      </div>

      {/* Transactions */}
      {selected && (
        <div className="card">
          <div className="card-header">
            <h3>{selected.bank_name} — {selected.account_title}</h3>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr>
              </thead>
              <tbody>
                {transactions.length === 0
                  ? <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No transactions</td></tr>
                  : transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="text-muted">{formatDate(t.transaction_date)}</td>
                      <td>{t.description}</td>
                      <td className="text-muted">{t.category || '—'}</td>
                      <td>
                        {t.type === 'credit'
                          ? <span className="badge badge-success"><ArrowDownLeft size={11} /> Credit</span>
                          : <span className="badge badge-danger"><ArrowUpRight size={11} /> Debit</span>}
                      </td>
                      <td className="text-right font-mono">{formatCurrency(t.amount, t.currency_code)}</td>
                      <td className="text-right font-mono text-muted">{t.balance_after != null ? formatCurrency(t.balance_after, selected.currency_code) : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <AccountModal wings={wings} onClose={() => setModal(false)} onSaved={() => { setModal(false); loadAccounts(); }} />}
      {txnModal && <TxnModal account={selected} wings={wings} onClose={() => setTxnModal(false)} onSaved={() => { setTxnModal(false); loadTxns(selected?.id); loadAccounts(); }} />}
    </div>
  );
}

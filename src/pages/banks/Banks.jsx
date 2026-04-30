import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { Plus, Landmark, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react';

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

function EditAccountModal({ account, wings, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    bank_name:            account.bank_name        || '',
    account_title:        account.account_title    || '',
    account_number_last4: account.account_number_last4 || '',
    branch:               account.branch           || '',
  });
  const [saving, setSaving] = useState(false);
  function f(k) { return (e) => setForm(p => ({ ...p, [k]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/banks/accounts/${account.id}`, form);
      toast('Account updated', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Edit Bank Account</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Bank Name *</label><input className="form-control" required value={form.bank_name} onChange={f('bank_name')} /></div>
              <div className="form-group"><label className="form-label">Account Number</label><input className="form-control" value={form.account_number_last4} onChange={f('account_number_last4')} /></div>
            </div>
            <div className="form-group"><label className="form-label">Account Title *</label><input className="form-control" required value={form.account_title} onChange={f('account_title')} /></div>
            <div className="form-group"><label className="form-label">Branch</label><input className="form-control" value={form.branch} onChange={f('branch')} /></div>
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

function TransferModal({ fromAccount, onClose, onSaved }) {
  const toast = useToast();
  const [allAccounts, setAllAccounts] = useState([]);
  const [form, setForm] = useState({ to_account_id: '', amount: '', txn_date: new Date().toISOString().split('T')[0], description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/banks/accounts').then(r => setAllAccounts(r.data)).catch(() => {});
  }, []);

  function f(k) { return (e) => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/banks/transfer', { from_account_id: fromAccount.id, ...form });
      toast('Transfer recorded', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Error', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Transfer / Loan to Account</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">From</label>
              <input className="form-control" disabled value={`${fromAccount.bank_name} — ${fromAccount.account_title}`} />
            </div>
            <div className="form-group">
              <label className="form-label">To Account *</label>
              <select className="form-control" required value={form.to_account_id} onChange={f('to_account_id')}>
                <option value="">Select account…</option>
                {allAccounts.filter(a => a.id !== fromAccount.id).map(a => (
                  <option key={a.id} value={a.id}>{a.bank_name} — {a.account_title} ({a.wing_name})</option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Amount *</label><input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} /></div>
              <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-control" required value={form.txn_date} onChange={f('txn_date')} /></div>
            </div>
            <div className="form-group"><label className="form-label">Note</label><input className="form-control" placeholder="Optional note" value={form.description} onChange={f('description')} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Processing…' : 'Transfer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TxnModal({ account, onClose, onSaved }) {
  const { wings } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    txn_type:           'Credit',
    txn_date:           new Date().toISOString().split('T')[0],
    amount:             '',
    currency:           account?.currency || 'PKR',
    description:        '',
    category:           '',
    wing_id:            account?.business_wing_id || '',
    linked_resource_id: '',
  });
  const [resources, setResources]     = useState([]);
  const [resourceSearch, setResourceSearch] = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    api.get('/resources', { params: { employment_status: 'active' } })
      .then(r => setResources(r.data))
      .catch(() => {});
  }, []);

  function f(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  const filteredResources = resourceSearch.trim()
    ? resources.filter(r => r.full_name?.toLowerCase().includes(resourceSearch.toLowerCase()))
    : resources;

  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/banks/transactions', {
        bank_account_id:    account.id,
        txn_type:           form.txn_type,
        txn_date:           form.txn_date,
        amount:             form.amount,
        currency:           form.currency,
        description:        form.description,
        reference_type:     form.category || null,
        wing_id:            form.wing_id || account.business_wing_id || null,
        linked_resource_id: form.linked_resource_id || null,
      });
      toast('Transaction recorded', 'success');
      onSaved();
    }
    catch (err) { toast(err.response?.data?.error || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Add Transaction</h3><button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
              <span className="text-muted">Account: </span>
              <strong>{account?.bank_name} — {account?.account_title}</strong>
              <span className="text-muted" style={{ marginLeft: 8 }}>Balance: {formatCurrency(account?.current_balance, account?.currency)}</span>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Type *</label>
                <select className="form-control" value={form.txn_type} onChange={f('txn_type')}>
                  <option value="Credit">Credit (In)</option>
                  <option value="Debit">Debit (Out)</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Date *</label>
                <input type="date" className="form-control" required value={form.txn_date} onChange={f('txn_date')} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Amount *</label>
                <input type="number" step="0.01" className="form-control" required value={form.amount} onChange={f('amount')} />
              </div>
              <div className="form-group"><label className="form-label">Currency</label>
                <select className="form-control" value={form.currency} onChange={f('currency')}>
                  {['PKR','USD','EUR','AED','GBP'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Description *</label>
              <input className="form-control" required value={form.description} onChange={f('description')} />
            </div>
            <div className="form-group"><label className="form-label">Category</label>
              <input className="form-control" placeholder="e.g. Client Payment, Utility, Salary" value={form.category} onChange={f('category')} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Link Transaction To</div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Business Wing</label>
                <select className="form-control" value={form.wing_id} onChange={f('wing_id')}>
                  <option value="">— None —</option>
                  {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Resource (Employee / Contractor)</label>
                <input
                  className="form-control"
                  placeholder="Search name…"
                  value={resourceSearch}
                  onChange={e => { setResourceSearch(e.target.value); setForm(p => ({ ...p, linked_resource_id: '' })); }}
                  style={{ marginBottom: 4 }}
                />
                {resourceSearch.trim() && (
                  <select className="form-control" size={Math.min(filteredResources.length + 1, 5)} value={form.linked_resource_id}
                    onChange={e => { setForm(p => ({ ...p, linked_resource_id: e.target.value })); setResourceSearch(resources.find(r => r.id === e.target.value)?.full_name || resourceSearch); }}>
                    <option value="">— None —</option>
                    {filteredResources.map(r => <option key={r.id} value={r.id}>{r.full_name}{r.designation ? ` (${r.designation})` : ''}</option>)}
                  </select>
                )}
                {form.linked_resource_id && (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
                    ✓ Linked: {resources.find(r => r.id === form.linked_resource_id)?.full_name}
                  </div>
                )}
              </div>
            </div>
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
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]     = useState(false);
  const [txnModal, setTxnModal]     = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [reverseTxn, setReverseTxn] = useState(null);
  const [reversing, setReversing]   = useState(false);
  const [loading, setLoading]       = useState(true);

  async function loadAccounts(preserveSelected = false) {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    try {
      const r = await api.get('/banks/accounts', { params });
      setAccounts(r.data);
      if (preserveSelected && selected) {
        const updated = r.data.find(a => a.id === selected.id);
        setSelected(updated || r.data[0] || null);
      } else if (!selected && r.data.length) {
        setSelected(r.data[0]);
      } else if (selected) {
        const updated = r.data.find(a => a.id === selected.id);
        if (updated) setSelected(updated);
      }
    }
    catch { toast('Failed to load accounts', 'error'); }
    finally { setLoading(false); }
  }

  async function loadTxns(accountId) {
    if (!accountId) return;
    try { setTransactions((await api.get('/banks/transactions', { params: { bank_account_id: accountId } })).data); }
    catch { toast('Failed to load transactions', 'error'); }
  }

  async function deleteAccount(id) {
    setDeleting(true);
    try {
      await api.delete(`/banks/accounts/${id}`);
      toast('Account deleted', 'success');
      setDeleteTarget(null);
      if (selected?.id === id) setSelected(null);
      loadAccounts();
    } catch (err) {
      toast(err.response?.data?.error || 'Error deleting account', 'error');
    } finally { setDeleting(false); }
  }

  async function reverseTransaction(id) {
    setReversing(true);
    try {
      await api.delete(`/banks/transactions/${id}`);
      toast('Transaction reversed and balance restored', 'success');
      setReverseTxn(null);
      loadTxns(selected?.id);
      loadAccounts(true);
    } catch (err) {
      toast(err.response?.data?.error || 'Error reversing transaction', 'error');
    } finally { setReversing(false); }
  }

  useEffect(() => { loadAccounts(); }, [activeWing]);
  useEffect(() => { if (selected) loadTxns(selected.id); }, [selected]);

  return (
    <div>
      <div className="page-header">
        <h1>Bank Accounts</h1>
        <div className="flex gap-2">
          {selected && <button className="btn btn-secondary" onClick={() => setTransferModal(true)}><ArrowLeftRight size={15} /> Transfer</button>}
          {selected && <button className="btn btn-secondary" onClick={() => setTxnModal(true)}><Plus size={15} /> Add Transaction</button>}
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Add Account</button>
        </div>
      </div>

      {/* Account cards */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        {accounts.map((a) => (
          <div key={a.id} onClick={() => setSelected(a)}
            className={`card ${selected?.id === a.id ? 'border-navy' : ''}`}
            style={{ padding: 16, cursor: 'pointer', minWidth: 220, border: selected?.id === a.id ? '2px solid var(--navy)' : undefined, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{a.wing_name}</div>
              <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px' }} onClick={() => setEditTarget(a)} title="Edit"><Pencil size={12} /></button>
                <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', color: 'var(--danger, #dc3545)' }} onClick={() => setDeleteTarget(a)} title="Delete"><Trash2 size={12} /></button>
              </div>
            </div>
            <div style={{ fontWeight: 600 }}>{a.bank_name}</div>
            <div className="text-muted">{a.account_title}</div>
            {a.account_number_last4 && <div className="text-muted" style={{ fontSize: 12 }}>A/C: {a.account_number_last4}</div>}
            {a.branch && <div className="text-muted" style={{ fontSize: 12 }}>{a.branch}</div>}
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: a.current_balance < 0 ? 'var(--danger, #dc3545)' : 'var(--navy)', marginTop: 6 }}>
              {formatCurrency(a.current_balance, a.currency_code || a.currency)}
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
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Wing</th><th>Resource</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th style={{ width: 80 }}></th></tr>
              </thead>
              <tbody>
                {transactions.length === 0
                  ? <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No transactions</td></tr>
                  : transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="text-muted">{formatDate(t.txn_date)}</td>
                      <td>{t.description}</td>
                      <td className="text-muted">{t.reference_type || '—'}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{t.wing_name || '—'}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{t.linked_resource_name || '—'}</td>
                      <td>
                        {t.txn_type === 'Credit'
                          ? <span className="badge badge-success"><ArrowDownLeft size={11} /> Credit</span>
                          : <span className="badge badge-danger"><ArrowUpRight size={11} /> Debit</span>}
                      </td>
                      <td className="text-right font-mono">{formatCurrency(t.amount, t.currency)}</td>
                      <td className="text-right font-mono text-muted">{t.running_balance != null ? formatCurrency(t.running_balance, selected.currency_code || selected.currency) : '—'}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger, #dc3545)' }}
                          onClick={() => setReverseTxn(t)}
                          title="Reverse this transaction"
                        >
                          Reverse
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <AccountModal wings={wings} onClose={() => setModal(false)} onSaved={() => { setModal(false); loadAccounts(); }} />}
      {editTarget && <EditAccountModal account={editTarget} wings={wings} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); loadAccounts(); }} />}
      {txnModal && <TxnModal account={selected} onClose={() => setTxnModal(false)} onSaved={() => { setTxnModal(false); loadTxns(selected?.id); loadAccounts(true); }} />}
      {transferModal && selected && <TransferModal fromAccount={selected} onClose={() => setTransferModal(false)} onSaved={() => { setTransferModal(false); loadTxns(selected?.id); loadAccounts(true); }} />}

      {reverseTxn && (
        <div className="modal-overlay" onClick={() => setReverseTxn(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Reverse Transaction</h3><button className="btn btn-secondary btn-sm" onClick={() => setReverseTxn(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="text-muted" style={{ fontSize: 12 }}>Date</span>
                  <span style={{ fontSize: 12 }}>{formatDate(reverseTxn.txn_date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="text-muted" style={{ fontSize: 12 }}>Description</span>
                  <span style={{ fontSize: 12, maxWidth: 220, textAlign: 'right' }}>{reverseTxn.description}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>Amount</span>
                  <span style={{ fontWeight: 700, color: reverseTxn.txn_type === 'Credit' ? 'var(--success)' : 'var(--danger)' }}>
                    {reverseTxn.txn_type === 'Credit' ? '+' : '-'}{formatCurrency(reverseTxn.amount, reverseTxn.currency)}
                  </span>
                </div>
              </div>
              <p className="text-muted" style={{ fontSize: 13 }}>
                This will delete the transaction and restore the account balance. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setReverseTxn(null)} disabled={reversing}>Cancel</button>
              <button className="btn btn-danger" disabled={reversing} onClick={() => reverseTransaction(reverseTxn.id)}>
                {reversing ? 'Reversing…' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Delete Account</h3><button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>✕</button></div>
            <div className="modal-body">
              <p>Delete <strong>{deleteTarget.bank_name} — {deleteTarget.account_title}</strong>?</p>
              <p className="text-muted" style={{ fontSize: 13 }}>This cannot be undone. Accounts with existing transactions cannot be deleted.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleting} onClick={() => deleteAccount(deleteTarget.id)}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

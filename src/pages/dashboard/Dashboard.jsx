import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { formatCurrency, formatDate, statusBadgeClass } from '../../lib/format';
import { Bell, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function Dashboard() {
  const { activeWing } = useAuth();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showPOs,      setShowPOs]      = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = activeWing?.id ? { wing_id: activeWing.id } : {};
    api.get('/dashboard', { params })
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeWing]);

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>Loading…</div>
  );
  if (!data) return null;

  const { invoices, purchase_orders, bank_balances, pending_tax, upcoming_reminders, upcoming_subscriptions, recent_transactions } = data;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        {activeWing && <span className="badge badge-navy">{activeWing.name}</span>}
      </div>

      {/* KPI Row */}
      <div className="stats-grid">
        <div className="stat-card electric">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Outstanding Invoices</div>
            <button onClick={() => setShowInvoices(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', lineHeight: 1 }}>
              {showInvoices ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
          </div>
          <div className="stat-value" style={{ letterSpacing: showInvoices ? undefined : 2 }}>
            {showInvoices ? formatCurrency(invoices?.outstanding_pkr) : '••••••'}
          </div>
          <div className="stat-sub">{invoices?.overdue_count} overdue</div>
        </div>
        <div className="stat-card lime">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label">Open POs Remaining</div>
            <button onClick={() => setShowPOs(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', lineHeight: 1 }}>
              {showPOs ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
          </div>
          <div className="stat-value" style={{ letterSpacing: showPOs ? undefined : 2 }}>
            {showPOs ? formatCurrency(purchase_orders?.remaining_value, purchase_orders?.currency) : '••••••'}
          </div>
          <div className="stat-sub">{purchase_orders?.total_count} purchase orders</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Pending Tax Due</div>
          <div className="stat-value">{formatCurrency(pending_tax?.total_due)}</div>
          <div className="stat-sub">{pending_tax?.count} challans pending</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Upcoming Reminders</div>
          <div className="stat-value">{upcoming_reminders?.length || 0}</div>
          <div className="stat-sub">in next 7 days</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 16 }}>
        {/* Bank Balances */}
        <div className="card">
          <div className="card-header"><h3>Bank Balances</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Account</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {bank_balances?.length ? bank_balances.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{b.bank_name}</td>
                    <td className="text-muted">{b.account_title}</td>
                    <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(b.current_balance, b.currency_code)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No accounts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {upcoming_reminders?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Bell size={14} color="var(--electric)"/> Upcoming Reminders
                </h3>
              </div>
              <ul style={{ listStyle: 'none' }}>
                {upcoming_reminders.map((r) => (
                  <li key={r.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div className="text-muted" style={{ marginTop: 2 }}>{formatDate(r.due_at)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {upcoming_subscriptions?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <RefreshCw size={14} color="var(--electric)"/> Upcoming Renewals
                </h3>
              </div>
              <ul style={{ listStyle: 'none' }}>
                {upcoming_subscriptions.map((s) => (
                  <li key={s.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{s.service_name}</span>
                    <span className="font-mono">{formatCurrency(s.pkr_amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>Recent Transactions</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th><th>Bank</th><th>Description</th>
                <th>Type</th><th style={{ textAlign: 'right' }}>Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {recent_transactions?.length ? recent_transactions.map((t) => (
                <tr key={t.id}>
                  <td className="text-muted">{formatDate(t.txn_date)}</td>
                  <td style={{ fontWeight: 500 }}>{t.bank_name}</td>
                  <td>{t.description}</td>
                  <td>
                    <span className={`badge ${t.txn_type === 'Credit' ? 'badge-success' : 'badge-danger'}`}>
                      {t.txn_type}
                    </span>
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>{formatCurrency(t.amount)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

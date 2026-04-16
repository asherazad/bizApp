import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import Topbar from '../../components/sidebar/Topbar'
import { StatusPill, SectionHeader } from '../../components/ui/index'
import { useDept } from '../../context/DeptContext'
import {
  mockPL, mockRevenueTrend, mockAlerts,
  mockInvoices, mockExpenseBreakdown
} from '../../lib/mockData'
import { formatShort, formatDate } from '../../lib/format'
import styles from './Dashboard.module.css'

// ─── KPI Card ────────────────────────────────────────────
function KpiCard({ label, value, delta, deltaLabel, positive }) {
  const isUp = delta > 0
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-delta ${positive ? (isUp ? 'delta-up' : 'delta-down') : (isUp ? 'delta-down' : 'delta-up')}`}>
        {delta > 0 ? '+' : ''}{delta}% {deltaLabel ?? 'vs last month'}
      </div>
    </div>
  )
}

// ─── Alert Row ───────────────────────────────────────────
const SEVERITY_CLS = { red:'alert-red', amber:'alert-amber', blue:'alert-blue' }
function AlertRow({ alert }) {
  return (
    <div className={`${styles.alertItem} ${styles[SEVERITY_CLS[alert.severity]]}`}>
      <span className={styles.alertDot} data-sev={alert.severity} />
      <span className={styles.alertMsg}>{alert.message}</span>
    </div>
  )
}

// ─── Custom tooltip for charts ───────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg-surface)', border:'0.5px solid var(--border)', borderRadius:'var(--r-md)', padding:'8px 12px', fontSize:12 }}>
      <p style={{ color:'var(--text-tertiary)', marginBottom:4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatShort(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { activeDept } = useDept()

  const pl = useMemo(() => {
    if (!activeDept) return mockPL.totals
    const d = mockPL.departments.find(d => d.dept_id === activeDept.id)
    return d ? { revenue: d.revenue, expenses: d.expenses, profit: d.profit } : mockPL.totals
  }, [activeDept])

  const prior    = mockPL.prior_month
  const revDelta = Math.round(((pl.revenue  - prior.revenue)  / prior.revenue)  * 100)
  const expDelta = Math.round(((pl.expenses - prior.expenses) / prior.expenses) * 100)
  const pnlDelta = Math.round(((pl.profit   - prior.profit)   / prior.profit)   * 100)

  const recentInvoices = useMemo(() => {
    const list = activeDept
      ? mockInvoices.filter(i => i.dept_id === activeDept.id)
      : mockInvoices
    return list.slice(0, 5)
  }, [activeDept])

  const deptPL = activeDept
    ? mockPL.departments.filter(d => d.dept_id === activeDept.id)
    : mockPL.departments

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar title="Dashboard" subtitle={mockPL.month} />

      <div className="page">
        {/* KPI row */}
        <div className="kpi-grid">
          <KpiCard label="Revenue (MTD)"  value={formatShort(pl.revenue)}  delta={revDelta}  positive />
          <KpiCard label="Expenses (MTD)" value={formatShort(pl.expenses)} delta={expDelta}  positive={false} />
          <KpiCard label="Net profit"     value={formatShort(pl.profit)}   delta={pnlDelta}  positive />
          <KpiCard label="Outstanding"    value="$9,800" delta={-8} positive={false} deltaLabel="vs last month" />
        </div>

        {/* Row 2 — trend chart + P&L table */}
        <div className={styles.row2}>
          {/* Revenue trend */}
          <div className="card" style={{ flex: 1.5 }}>
            <SectionHeader title="Revenue vs expenses — last 6 months" />
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={mockRevenueTrend} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#185FA5" stopOpacity={0.12}/>
                    <stop offset="100%" stopColor="#185FA5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#854F0B" stopOpacity={0.10}/>
                    <stop offset="100%" stopColor="#854F0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-tertiary)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}k`}/>
                <Tooltip content={<ChartTooltip />}/>
                <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#185FA5" strokeWidth={1.5} fill="url(#revGrad)"/>
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#854F0B" strokeWidth={1.5} fill="url(#expGrad)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Dept P&L */}
          <div className="card" style={{ flex: 1 }}>
            <SectionHeader title="Department P&L" />
            <table style={{ width:'100%', fontSize:12.5, borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Dept','Revenue','Expenses','Profit'].map(h => (
                    <th key={h} style={{ textAlign: h==='Dept'?'left':'right', padding:'4px 6px', fontSize:11, color:'var(--text-tertiary)', fontWeight:500, borderBottom:'0.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptPL.map(d => (
                  <tr key={d.dept_id}>
                    <td style={{ padding:'8px 6px', fontWeight:500 }}>{d.name}</td>
                    <td style={{ padding:'8px 6px', textAlign:'right', color:'var(--text-secondary)' }}>{formatShort(d.revenue)}</td>
                    <td style={{ padding:'8px 6px', textAlign:'right', color:'var(--text-secondary)' }}>{formatShort(d.expenses)}</td>
                    <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:500, color: d.profit >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>
                      {d.profit >= 0 ? '+' : ''}{formatShort(d.profit)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop:'0.5px solid var(--border)' }}>
                  <td style={{ padding:'8px 6px', fontWeight:500 }}>Total</td>
                  <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:500 }}>{formatShort(mockPL.totals.revenue)}</td>
                  <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:500 }}>{formatShort(mockPL.totals.expenses)}</td>
                  <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:500, color:'var(--green-600)' }}>+{formatShort(mockPL.totals.profit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 3 — expense donut + alerts + recent invoices */}
        <div className={styles.row3}>
          {/* Expense breakdown */}
          <div className="card">
            <SectionHeader title="Expense breakdown" />
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={mockExpenseBreakdown} dataKey="amount" nameKey="category" cx="40%" cy="50%" outerRadius={72} innerRadius={42}>
                  {mockExpenseBreakdown.map((e, i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={v => formatShort(v)} contentStyle={{ fontSize:12, borderRadius:'var(--r-md)', border:'0.5px solid var(--border)' }}/>
                <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Alerts */}
          <div className="card">
            <SectionHeader title="Alerts & reminders" />
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {mockAlerts.map(a => <AlertRow key={a.id} alert={a}/>)}
            </div>
          </div>

          {/* Recent invoices */}
          <div className="card">
            <SectionHeader title="Recent invoices" action={
              <a href="/invoices" style={{ fontSize:12, color:'var(--blue-600)' }}>View all →</a>
            }/>
            <table className="data-table" style={{ fontSize:12 }}>
              <thead>
                <tr>
                  <th>Invoice</th><th>Client</th><th style={{ textAlign:'right' }}>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>{inv.number}</td>
                    <td className="truncate" style={{ maxWidth:90 }}>{inv.client}</td>
                    <td style={{ textAlign:'right', fontWeight:500 }}>{formatShort(inv.amount)}</td>
                    <td><StatusPill status={inv.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, Printer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Period presets ───────────────────────────────────────────────────────────
function getPresetRange(key) {
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth();
  const pad  = n => String(n).padStart(2, '0');
  const last = (yr, mo) => new Date(yr, mo + 1, 0).toISOString().split('T')[0];

  if (key === 'month')   return { from: `${y}-${pad(m + 1)}-01`,        to: last(y, m) };
  if (key === 'last3') {
    const s = new Date(y, m - 2, 1);
    return { from: s.toISOString().split('T')[0], to: last(y, m) };
  }
  if (key === 'last6') {
    const s = new Date(y, m - 5, 1);
    return { from: s.toISOString().split('T')[0], to: last(y, m) };
  }
  if (key === 'ytd') return { from: `${y}-01-01`, to: last(y, m) };
  return null;
}

const PRESETS = [
  { key: 'month', label: 'This Month' },
  { key: 'last3', label: 'Last 3M' },
  { key: 'last6', label: 'Last 6M' },
  { key: 'ytd',   label: 'YTD' },
  { key: 'custom', label: 'Custom' },
];

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt   = v => formatCurrency(v);
const fmtK  = v => `₨ ${Math.round((v || 0) / 1000).toLocaleString()}K`;
const fmtM  = v => {
  const n = Math.abs(v || 0);
  if (n >= 1_000_000) return `₨ ${(v / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₨ ${(v / 1_000).toFixed(0)}K`;
  return `₨ ${Math.round(v || 0).toLocaleString()}`;
};

function MarginBadge({ pct }) {
  const color = pct >= 30 ? '#16a34a' : pct >= 10 ? '#d97706' : '#dc2626';
  const Icon  = pct >= 30 ? TrendingUp : pct >= 10 ? Minus : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, fontWeight: 600 }}>
      <Icon size={12}/> {pct.toFixed(1)}%
    </span>
  );
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-md)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 12, boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{monthLabel(label)}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── PDF export helper (hidden iframe) ───────────────────────────────────────
function exportPDF(summary, from, to, wingName) {
  const rows = summary.wings.map(w => `
    <tr>
      <td>${w.wing_name}</td>
      <td class="num">${fmt(w.revenue)}</td>
      <td class="num">${fmt(w.payroll_cost)}</td>
      <td class="num">${fmt(w.operating_cost)}</td>
      <td class="num">${fmt(w.tax_provision)}</td>
      <td class="num" style="font-weight:700">${fmt(w.net_profit)}</td>
      <td class="num">${w.margin_pct.toFixed(1)}%</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Wing P&L</title><style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
    h1 { font-size: 15px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 10px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1A1C30; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; }
    td { padding: 6px 10px; border-bottom: 1px solid #eee; }
    .num { text-align: right; font-family: monospace; }
    @page { size: landscape; margin: 15mm; }
  </style></head><body>
    <h1>Wing P&L Report${wingName ? ' — ' + wingName : ''}</h1>
    <div class="sub">Period: ${from} to ${to} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString()}</div>
    <table>
      <thead><tr>
        <th>Wing</th><th style="text-align:right">Revenue</th><th style="text-align:right">Payroll</th>
        <th style="text-align:right">Operating</th><th style="text-align:right">Tax Prov.</th>
        <th style="text-align:right">Net Profit</th><th style="text-align:right">Margin%</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 400);
}

function exportCSV(summary, from, to) {
  const header = 'Wing,Revenue,Payroll Cost,Operating Cost,Tax Provision,Total Cost,Net Profit,Margin%';
  const rows = summary.wings.map(w =>
    [w.wing_name, w.revenue, w.payroll_cost, w.operating_cost, w.tax_provision, w.total_cost, w.net_profit, w.margin_pct].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pl_report_${from}_to_${to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Reports() {
  const { activeWing } = useAuth();

  const [wings, setWings]         = useState([]);
  const [wingId, setWingId]       = useState('');
  const [preset, setPreset]       = useState('month');
  const [from, setFrom]           = useState(() => getPresetRange('month').from);
  const [to, setTo]               = useState(() => getPresetRange('month').to);
  const [summary, setSummary]     = useState(null);
  const [trend, setTrend]         = useState([]);
  const [receivables, setReceivables] = useState(null);
  const [pipeline, setPipeline]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [recBucket, setRecBucket] = useState(null); // expanded receivable bucket

  // Load wings list
  useEffect(() => {
    api.get('/wings').then(r => setWings(r.data)).catch(() => {});
  }, []);

  // Auto-set wingId when activeWing changes
  useEffect(() => {
    setWingId(activeWing?.id || '');
  }, [activeWing]);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (wingId) params.wing_id = wingId;

    Promise.all([
      api.get('/reports/summary',     { params: { ...params, from, to } }),
      api.get('/reports/trend',       { params }),
      api.get('/reports/receivables', { params }),
      api.get('/reports/po-pipeline', { params }),
    ])
      .then(([s, t, r, p]) => {
        setSummary(s.data);
        setTrend(t.data);
        setReceivables(r.data);
        setPipeline(p.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wingId, from, to]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(key) {
    setPreset(key);
    if (key !== 'custom') {
      const r = getPresetRange(key);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  // Aggregate KPIs across all wings in the summary
  const totals = summary?.wings?.reduce((acc, w) => ({
    revenue:        acc.revenue        + w.revenue,
    payroll_cost:   acc.payroll_cost   + w.payroll_cost,
    operating_cost: acc.operating_cost + w.operating_cost,
    tax_provision:  acc.tax_provision  + w.tax_provision,
    net_profit:     acc.net_profit     + w.net_profit,
  }), { revenue: 0, payroll_cost: 0, operating_cost: 0, tax_provision: 0, net_profit: 0 });

  const avgMargin = totals && totals.revenue > 0
    ? parseFloat((totals.net_profit / totals.revenue * 100).toFixed(1))
    : 0;

  const selectedWingName = wingId ? wings.find(w => w.id === wingId)?.name : '';

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1>Wing P&L Reports</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>

          {/* Period Presets */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface-3)', borderRadius: 'var(--r-sm)', padding: 3 }}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                style={{
                  padding: '4px 10px', border: 'none', borderRadius: 'var(--r-xs)',
                  fontSize: 12, cursor: 'pointer', fontWeight: 500,
                  background: preset === p.key ? 'var(--electric)' : 'transparent',
                  color: preset === p.key ? '#fff' : 'var(--ink-3)',
                }}
              >{p.label}</button>
            ))}
          </div>

          {preset === 'custom' && (
            <>
              <input type="date" className="form-input" style={{ height: 32, fontSize: 12, width: 140 }}
                value={from} onChange={e => setFrom(e.target.value)}/>
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>→</span>
              <input type="date" className="form-input" style={{ height: 32, fontSize: 12, width: 140 }}
                value={to} onChange={e => setTo(e.target.value)}/>
            </>
          )}

          {/* Wing Filter */}
          <select className="form-input" style={{ height: 32, fontSize: 12, width: 160 }}
            value={wingId} onChange={e => setWingId(e.target.value)}>
            <option value="">All Wings</option>
            {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          {/* Export */}
          <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 12 }}
            onClick={() => summary && exportCSV(summary, from, to)}>
            <Download size={13}/> CSV
          </button>
          <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 12 }}
            onClick={() => summary && exportPDF(summary, from, to, selectedWingName)}>
            <Printer size={13}/> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>Loading reports…</div>
      ) : (
        <>
          {/* ── KPI Cards ────────────────────────────────────────────────── */}
          {totals && (
            <div className="stats-grid">
              <div className="stat-card electric">
                <div className="stat-label">Total Revenue</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmtM(totals.revenue)}</div>
                <div className="stat-sub">{from} → {to}</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">Total Cost (Payroll + Ops)</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmtM(totals.payroll_cost + totals.operating_cost)}</div>
                <div className="stat-sub">Tax provision: {fmtM(totals.tax_provision)}</div>
              </div>
              <div className={`stat-card ${totals.net_profit >= 0 ? 'success' : 'danger'}`} style={totals.net_profit < 0 ? { background: 'var(--danger-light)' } : {}}>
                <div className="stat-label">Net Profit</div>
                <div className="stat-value" style={{ fontSize: 18, color: totals.net_profit < 0 ? 'var(--danger-text)' : undefined }}>
                  {fmtM(totals.net_profit)}
                </div>
                <div className="stat-sub">After tax provision</div>
              </div>
              <div className="stat-card lime">
                <div className="stat-label">Avg Margin</div>
                <div className="stat-value" style={{ fontSize: 18 }}>
                  {avgMargin.toFixed(1)}%
                </div>
                <div className="stat-sub">Across {summary.wings.filter(w => w.revenue > 0).length} active wings</div>
              </div>
            </div>
          )}

          {/* ── Wing P&L Table ───────────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3>Wing Profit & Loss — {from} to {to}</h3>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Wing</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Payroll</th>
                    <th style={{ textAlign: 'right' }}>Operating</th>
                    <th style={{ textAlign: 'right' }}>Tax Provision</th>
                    <th style={{ textAlign: 'right' }}>Net Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.wings?.map(w => (
                    <tr key={w.wing_id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{w.wing_name}</span>
                        {w.wing_code && <span className="badge badge-navy" style={{ marginLeft: 6, fontSize: 10 }}>{w.wing_code}</span>}
                      </td>
                      <td className="font-mono" style={{ textAlign: 'right', color: '#16a34a' }}>{fmt(w.revenue)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--ink-2)' }}>{fmt(w.payroll_cost)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--ink-2)' }}>{fmt(w.operating_cost)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: w.tax_provision > 0 ? '#d97706' : 'var(--ink-3)' }}>
                        {w.tax_provision > 0 ? fmt(w.tax_provision) : '—'}
                      </td>
                      <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: w.net_profit >= 0 ? '#16a34a' : '#dc2626' }}>
                        {fmt(w.net_profit)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {w.revenue > 0 ? <MarginBadge pct={w.margin_pct}/> : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  {totals && summary?.wings?.length > 1 && (
                    <tr style={{ background: 'var(--surface-3)', fontWeight: 700 }}>
                      <td>Total</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: '#16a34a' }}>{fmt(totals.revenue)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(totals.payroll_cost)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(totals.operating_cost)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: '#d97706' }}>{fmt(totals.tax_provision)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: totals.net_profit >= 0 ? '#16a34a' : '#dc2626' }}>
                        {fmt(totals.net_profit)}
                      </td>
                      <td style={{ textAlign: 'right' }}><MarginBadge pct={avgMargin}/></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 6-Month Trend Chart ──────────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3>6-Month Revenue vs Cost Trend</h3></div>
            <div style={{ padding: '8px 16px 16px' }}>
              {trend.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trend} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: 'var(--ink-3)' }}/>
                    <YAxis tickFormatter={v => `${Math.round(v / 1000)}K`} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} width={52}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Legend wrapperStyle={{ fontSize: 12 }}/>
                    <Bar dataKey="revenue"        name="Revenue"   fill="#ef5f28" radius={[3, 3, 0, 0]}/>
                    <Bar dataKey="payroll_cost"   name="Payroll"   fill="#FFAA00" radius={[3, 3, 0, 0]} stackId="cost"/>
                    <Bar dataKey="operating_cost" name="Operating" fill="#FF5C5C" radius={[3, 3, 0, 0]} stackId="cost"/>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 40 }}>No trend data available</div>
              )}
            </div>
          </div>

          {/* ── Bottom grid: Receivables + PO Pipeline ───────────────────── */}
          <div className="grid-2" style={{ gap: 16 }}>

            {/* Receivables Aging */}
            <div className="card">
              <div className="card-header">
                <h3>Receivables Aging</h3>
                {receivables && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    Total: <strong style={{ color: '#dc2626' }}>{fmt(receivables.total_outstanding)}</strong>
                  </span>
                )}
              </div>
              {receivables?.summary?.map(bucket => (
                <div key={bucket.bucket}>
                  <button
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}
                    onClick={() => setRecBucket(recBucket === bucket.bucket ? null : bucket.bucket)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background:
                          bucket.bucket === '0-30' ? '#16a34a' :
                          bucket.bucket === '31-60' ? '#d97706' :
                          bucket.bucket === '61-90' ? '#ea580c' : '#dc2626',
                      }}/>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{bucket.bucket} days</span>
                      <span className="badge badge-neutral">{bucket.count}</span>
                    </span>
                    <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: bucket.count > 0 ? '#dc2626' : 'var(--ink-3)' }}>
                      {bucket.total > 0 ? fmt(bucket.total) : '—'}
                    </span>
                  </button>

                  {recBucket === bucket.bucket && bucket.items.length > 0 && (
                    <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <table className="table" style={{ fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th>Invoice</th><th>Client</th><th>Due</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bucket.items.map(inv => (
                            <tr key={inv.id}>
                              <td style={{ fontWeight: 500 }}>{inv.invoice_number || '—'}</td>
                              <td className="text-muted">{inv.client_name || '—'}</td>
                              <td className="text-muted">{formatDate(inv.due_date || inv.invoice_date)}</td>
                              <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(inv.pkr_equivalent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
              {!receivables?.summary?.some(b => b.count > 0) && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No outstanding invoices</div>
              )}
            </div>

            {/* PO Pipeline */}
            <div className="card">
              <div className="card-header">
                <h3>PO Pipeline</h3>
                {pipeline.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{pipeline.length} active POs</span>
                )}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>PO / Client</th>
                      <th>Wing</th>
                      <th style={{ textAlign: 'right' }}>Remaining</th>
                      <th style={{ textAlign: 'right' }}>Used%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.length ? pipeline.map(po => (
                      <tr key={po.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{po.po_number}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{po.client_name || '—'}</div>
                          {po.projected_end && (
                            <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
                              Est. exhausted: {formatDate(po.projected_end)}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 11 }}>{po.wing_name}</td>
                        <td className="font-mono" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: po.remaining < po.po_value * 0.15 ? '#dc2626' : '#16a34a' }}>
                          {po.currency !== 'PKR'
                            ? `${po.currency} ${parseFloat(po.remaining).toLocaleString()}`
                            : fmt(po.remaining)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{po.pct_used}%</span>
                            <div style={{ width: 60, height: 4, background: 'var(--border-md)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 2,
                                width: `${Math.min(100, po.pct_used)}%`,
                                background: po.pct_used >= 85 ? '#dc2626' : po.pct_used >= 60 ? '#d97706' : '#16a34a',
                              }}/>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}>No active POs</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

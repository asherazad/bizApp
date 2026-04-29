import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Upload, Calendar } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const TODAY    = new Date().toISOString().split('T')[0];
const CUR_YEAR = new Date().getFullYear();
const CUR_MON  = new Date().getMonth() + 1; // 1-based

const STATUS_BADGE = {
  present:        'badge-success',
  half_day:       'badge-danger',
  leave:          'badge-warning',
  absent:         'badge-danger',
  holiday:        'badge-neutral',
  work_from_home: 'badge-info',
};

const GRID_STYLE = {
  present:  { bg: 'rgba(34,197,94,.15)',  color: '#16a34a', label: 'P' },
  half_day: { bg: 'rgba(249,115,22,.15)', color: '#ea580c', label: 'H' },
  leave:    { bg: 'rgba(245,158,11,.15)', color: '#d97706', label: 'L' },
  absent:   { bg: 'rgba(239,68,68,.15)',  color: '#dc2626', label: 'A' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcHours(ci, co) {
  if (!ci || !co) return null;
  const toM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const d = toM(co) - toM(ci);
  if (d <= 0) return null;
  const h = Math.floor(d / 60), m = d % 60;
  return { label: m ? `${h}h ${m}m` : `${h}h`, short: d < 480 };
}

function monthRange(year, month) {
  const pad  = n => String(n).padStart(2, '0');
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${last}` };
}

function daysInMonth(year, month) {
  const days = [];
  const total = new Date(year, month, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    days.push({ date: dateStr, day: d, dow, weekend: dow === 0 || dow === 6 });
  }
  return days;
}

const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Import button (shared across tabs) ──────────────────────────────────────
function ImportButton({ onImported }) {
  const toast      = useToast();
  const importRef  = useRef();
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/attendance/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast(data.message, 'success');
      onImported?.();
    } catch (err) {
      const raw = err.response?.data?.detail ?? err.response?.data?.error ?? err.message ?? 'Import failed';
      toast(typeof raw === 'string' ? raw : JSON.stringify(raw), 'error');
    } finally { setBusy(false); }
  }

  return (
    <>
      <input type="file" accept=".xlsx,.xls" ref={importRef} style={{ display: 'none' }} onChange={handleFile} />
      <button className="btn btn-primary" onClick={() => importRef.current?.click()} disabled={busy}>
        <Upload size={14} /> {busy ? 'Importing…' : 'Import Biometric'}
      </button>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Daily View
// ══════════════════════════════════════════════════════════════════════════════
function DailyView({ wing }) {
  const toast = useToast();
  const [date,    setDate]    = useState(TODAY);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load(d) {
    setLoading(true);
    try {
      const params = { from: d, to: d, ...(wing?.id ? { wing_id: wing.id } : {}) };
      const { data } = await api.get('/attendance', { params });
      setRecords(data);
    } catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(date); }, [date, wing]);

  const presentCount  = records.filter(r => r.status === 'present').length;
  const halfCount     = records.filter(r => r.status === 'half_day').length;
  const leaveCount    = records.filter(r => r.status === 'leave').length;

  return (
    <div>
      {/* Date picker + summary */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Date</span>
          <input
            type="date"
            className="form-control"
            style={{ height: 34, width: 160 }}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: `${presentCount} Present`,  cls: 'badge-success' },
            { label: `${halfCount} Short Hrs`,   cls: 'badge-danger'  },
            { label: `${leaveCount} Leave`,       cls: 'badge-warning' },
            { label: `${records.length} Total`,   cls: 'badge-neutral' },
          ].map(b => (
            <span key={b.label} className={`badge ${b.cls}`} style={{ fontSize: 12, padding: '4px 10px' }}>{b.label}</span>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr><th>Name</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }} className="text-muted">Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }} className="text-muted">No records for this date.</td></tr>
              ) : records.map(r => {
                const hrs = calcHours(r.check_in, r.check_out);
                return (
                  <tr key={r.id} style={r.status === 'half_day' ? { background: 'rgba(249,115,22,.05)' } : undefined}>
                    <td style={{ fontWeight: 500 }}>{r.resource_name}</td>
                    <td className="font-mono">{r.check_in  || '—'}</td>
                    <td className="font-mono">{r.check_out || '—'}</td>
                    <td className="font-mono" style={hrs?.short ? { color: 'var(--warning)', fontWeight: 600 } : undefined}>
                      {hrs ? hrs.label : '—'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status] || 'badge-neutral'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                        {(r.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Monthly Grid
// ══════════════════════════════════════════════════════════════════════════════
function MonthlyView({ wing }) {
  const toast = useToast();
  const [year,      setYear]      = useState(CUR_YEAR);
  const [month,     setMonth]     = useState(CUR_MON);
  const [resources, setResources] = useState([]);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);

  async function load(y, m) {
    setLoading(true);
    try {
      const { from, to } = monthRange(y, m);
      const params = { ...(wing?.id ? { wing_id: wing.id } : {}) };
      const [resRes, attRes] = await Promise.all([
        api.get('/resources', { params }),
        api.get('/attendance', { params: { ...params, from, to } }),
      ]);
      setResources(resRes.data);
      setRecords(attRes.data);
    } catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(year, month); }, [year, month, wing]);

  // Build lookup: resourceId → { 'YYYY-MM-DD': record }
  const lookup = {};
  for (const r of records) {
    const key = r.resource_id;
    if (!lookup[key]) lookup[key] = {};
    lookup[key][r.record_date?.slice(0, 10)] = r;
  }

  const days = daysInMonth(year, month);

  // Per-resource summary
  function summary(rid) {
    const recs = Object.values(lookup[rid] || {});
    return {
      P: recs.filter(r => r.status === 'present').length,
      H: recs.filter(r => r.status === 'half_day').length,
      L: recs.filter(r => r.status === 'leave').length,
    };
  }

  return (
    <div>
      {/* Month / Year picker */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <select className="form-control" style={{ width: 110, height: 34 }} value={month} onChange={e => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-control" style={{ width: 90, height: 34 }} value={year} onChange={e => setYear(+e.target.value)}>
          {[CUR_YEAR - 1, CUR_YEAR, CUR_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, marginLeft: 8, fontSize: 11 }}>
          {Object.entries(GRID_STYLE).map(([k, v]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: v.bg, border: `1px solid ${v.color}`, display: 'inline-block', fontWeight: 700, fontSize: 9, color: v.color, textAlign: 'center', lineHeight: '14px' }}>{v.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>{k.replace('_', ' ')}</span>
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }} className="text-muted">Loading…</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2, minWidth: 140, whiteSpace: 'nowrap' }}>Resource</th>
                  {days.map(d => (
                    <th
                      key={d.date}
                      style={{
                        textAlign: 'center', padding: '4px 3px', minWidth: 28,
                        background: d.weekend ? 'var(--surface-2)' : 'var(--surface)',
                        color: d.weekend ? 'var(--text-muted)' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 400, lineHeight: 1 }}>{DOW[d.dow]}</div>
                      <div style={{ fontWeight: 700 }}>{d.day}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', minWidth: 30, color: '#16a34a' }}>P</th>
                  <th style={{ textAlign: 'center', minWidth: 30, color: '#ea580c' }}>H</th>
                  <th style={{ textAlign: 'center', minWidth: 30, color: '#d97706' }}>L</th>
                </tr>
              </thead>
              <tbody>
                {resources.length === 0 ? (
                  <tr><td colSpan={days.length + 4} style={{ textAlign: 'center', padding: 32 }} className="text-muted">No resources found.</td></tr>
                ) : resources.map(res => {
                  const s = summary(res.id);
                  return (
                    <tr key={res.id}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1, fontWeight: 500, whiteSpace: 'nowrap', padding: '4px 10px' }}>
                        {res.full_name}
                      </td>
                      {days.map(d => {
                        if (d.weekend) {
                          return <td key={d.date} style={{ background: 'var(--surface-2)', textAlign: 'center', padding: '3px 2px', color: 'var(--text-muted)', fontSize: 10 }}>—</td>;
                        }
                        const rec = lookup[res.id]?.[d.date];
                        const gs  = rec ? (GRID_STYLE[rec.status] || null) : null;
                        return (
                          <td
                            key={d.date}
                            title={rec ? `${rec.check_in || '?'} – ${rec.check_out || '?'}` : 'No record'}
                            style={{ textAlign: 'center', padding: '3px 2px', background: gs ? gs.bg : undefined }}
                          >
                            {gs
                              ? <span style={{ fontSize: 10, fontWeight: 700, color: gs.color, fontFamily: 'var(--font-mono)' }}>{gs.label}</span>
                              : <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
                            }
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#16a34a', fontSize: 11 }}>{s.P || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#ea580c', fontSize: 11 }}>{s.H || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#d97706', fontSize: 11 }}>{s.L || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Resource View
// ══════════════════════════════════════════════════════════════════════════════
function ResourceView({ wing }) {
  const toast = useToast();
  const FIRST_OF_MON = TODAY.slice(0, 7) + '-01';
  const [resources,   setResources]   = useState([]);
  const [selectedId,  setSelectedId]  = useState('');
  const [from,        setFrom]        = useState(FIRST_OF_MON);
  const [to,          setTo]          = useState(TODAY);
  const [records,     setRecords]     = useState([]);
  const [loading,     setLoading]     = useState(false);

  // Load resource list once
  useEffect(() => {
    api.get('/resources', { params: wing?.id ? { wing_id: wing.id } : {} })
      .then(r => {
        setResources(r.data);
        if (r.data.length) setSelectedId(r.data[0].id);
      })
      .catch(() => toast('Failed to load resources', 'error'));
  }, [wing]);

  async function load() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/attendance', {
        params: { resource_id: selectedId, from, to },
      });
      setRecords(data);
    } catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [selectedId, from, to]);

  const presentCount  = records.filter(r => r.status === 'present').length;
  const halfCount     = records.filter(r => r.status === 'half_day').length;
  const leaveCount    = records.filter(r => r.status === 'leave').length;
  const totalDays     = records.length;

  const selectedRes = resources.find(r => r.id === selectedId);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          className="form-control"
          style={{ height: 34, minWidth: 200 }}
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          {resources.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From</span>
          <input type="date" className="form-control" style={{ height: 34 }} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To</span>
          <input type="date" className="form-control" style={{ height: 34 }} value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card success">
          <div className="stat-label">Present</div>
          <div className="stat-value">{presentCount}</div>
          <div className="stat-sub">days ≥ 8 hrs</div>
        </div>
        <div className="stat-card electric">
          <div className="stat-label">Short Hours</div>
          <div className="stat-value">{halfCount}</div>
          <div className="stat-sub">under 8 hrs</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Leave</div>
          <div className="stat-value">{leaveCount}</div>
          <div className="stat-sub">no punch</div>
        </div>
        <div className="stat-card lime">
          <div className="stat-label">Attendance %</div>
          <div className="stat-value">
            {totalDays ? `${Math.round((presentCount / totalDays) * 100)}%` : '—'}
          </div>
          <div className="stat-sub">of {totalDays} days</div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Hours Worked</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }} className="text-muted">Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }} className="text-muted">
                  No records for {selectedRes?.full_name || 'this resource'} in selected range.
                </td></tr>
              ) : records.map(r => {
                const hrs = calcHours(r.check_in, r.check_out);
                return (
                  <tr key={r.id} style={r.status === 'half_day' ? { background: 'rgba(249,115,22,.05)' } : undefined}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{formatDate(r.record_date)}</td>
                    <td className="font-mono">{r.check_in  || '—'}</td>
                    <td className="font-mono">{r.check_out || '—'}</td>
                    <td className="font-mono" style={hrs?.short ? { color: 'var(--warning)', fontWeight: 600 } : undefined}>
                      {hrs ? hrs.label : '—'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status] || 'badge-neutral'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                        {(r.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main page — tab shell
// ══════════════════════════════════════════════════════════════════════════════
export default function Attendance() {
  const { activeWing } = useAuth();
  const [tab, setTab]  = useState('daily');
  const [importKey, setImportKey] = useState(0); // bumped after import to refresh active tab

  const TABS = [
    { id: 'daily',    label: 'Daily View'    },
    { id: 'monthly',  label: 'Monthly Grid'  },
    { id: 'resource', label: 'Resource View' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Attendance</h1>
        {activeWing && <span className="badge badge-navy">{activeWing.name}</span>}
        <ImportButton onImported={() => setImportKey(k => k + 1)} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'daily'    && <DailyView    key={`daily-${importKey}`}    wing={activeWing} />}
      {tab === 'monthly'  && <MonthlyView  key={`monthly-${importKey}`}  wing={activeWing} />}
      {tab === 'resource' && <ResourceView key={`resource-${importKey}`} wing={activeWing} />}
    </div>
  );
}

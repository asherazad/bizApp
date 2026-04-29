import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Upload, Calendar, Users, CheckCircle, XCircle, Clock } from 'lucide-react';

const TODAY        = new Date().toISOString().split('T')[0];
const FIRST_OF_MON = TODAY.slice(0, 7) + '-01';

const STATUS_OPTIONS = ['present', 'absent', 'leave', 'half_day', 'holiday', 'work_from_home'];

const STATUS_BADGE = {
  present:        'badge-success',
  absent:         'badge-danger',
  leave:          'badge-warning',
  half_day:       'badge-danger',
  holiday:        'badge-neutral',
  work_from_home: 'badge-info',
};

function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const diff = toMins(checkOut) - toMins(checkIn);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60), m = diff % 60;
  return { label: m ? `${h}h ${m}m` : `${h}h`, short: diff < 8 * 60 };
}

export default function Attendance() {
  const { activeWing } = useAuth();
  const toast          = useToast();
  const importRef      = useRef();

  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [importing, setImporting] = useState(false);
  const [filters,   setFilters]   = useState({
    from: FIRST_OF_MON, to: TODAY, search: '', status: '',
  });

  async function load() {
    setLoading(true);
    const params = {
      ...(activeWing?.id   ? { wing_id: activeWing.id } : {}),
      ...(filters.from     ? { from: filters.from }     : {}),
      ...(filters.to       ? { to: filters.to }         : {}),
      ...(filters.status   ? { status: filters.status } : {}),
    };
    try {
      const { data } = await api.get('/attendance', { params });
      setRecords(data);
    } catch {
      toast('Failed to load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeWing, filters.from, filters.to, filters.status]);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/attendance/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast(data.message, 'success');
      load();
    } catch (err) {
      const raw = err.response?.data?.detail ?? err.response?.data?.error ?? err.message ?? 'Import failed';
      toast(typeof raw === 'string' ? raw : JSON.stringify(raw), 'error');
    } finally {
      setImporting(false);
    }
  }

  function filt(k) { return e => setFilters(p => ({ ...p, [k]: e.target.value })); }

  const displayed = filters.search
    ? records.filter(r => r.resource_name?.toLowerCase().includes(filters.search.toLowerCase()))
    : records;

  const presentCount  = displayed.filter(r => r.status === 'present').length;
  const halfDayCount  = displayed.filter(r => r.status === 'half_day').length;
  const leaveCount    = displayed.filter(r => r.status === 'leave').length;

  return (
    <div>
      <div className="page-header">
        <h1>Attendance</h1>
        {activeWing && <span className="badge badge-navy">{activeWing.name}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={importRef}
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button
            className="btn btn-primary"
            onClick={() => importRef.current?.click()}
            disabled={importing}
          >
            <Upload size={14} /> {importing ? 'Importing…' : 'Import Biometric'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-control"
          style={{ maxWidth: 200, height: 34 }}
          placeholder="Search name…"
          value={filters.search}
          onChange={filt('search')}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From</span>
          <input type="date" className="form-control" style={{ height: 34 }} value={filters.from} onChange={filt('from')} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To</span>
          <input type="date" className="form-control" style={{ height: 34 }} value={filters.to} onChange={filt('to')} />
        </div>
        <select className="form-control" style={{ maxWidth: 170, height: 34 }} value={filters.status} onChange={filt('status')}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {(filters.search || filters.status) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setFilters(p => ({ ...p, search: '', status: '' }))}
          >
            Clear
          </button>
        )}
        <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {displayed.length} record{displayed.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* KPI cards */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card success">
          <div className="stat-label">Present</div>
          <div className="stat-value">{presentCount}</div>
          <div className="stat-sub">≥ 8 hrs worked</div>
        </div>
        <div className="stat-card electric">
          <div className="stat-label">Short Hours</div>
          <div className="stat-value">{halfDayCount}</div>
          <div className="stat-sub">under 8 hrs</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Leave</div>
          <div className="stat-value">{leaveCount}</div>
          <div className="stat-sub">no punch</div>
        </div>
        <div className="stat-card lime">
          <div className="stat-label">Total Records</div>
          <div className="stat-value">{displayed.length}</div>
          <div className="stat-sub">in selected range</div>
        </div>
      </div>

      {/* Attendance table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Hours Worked</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32 }} className="text-muted">
                    Loading…
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>
                    <Calendar size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
                    <span className="text-muted">
                      No attendance records found.{' '}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ display: 'inline' }}
                        onClick={() => importRef.current?.click()}
                      >
                        Import a biometric Excel file
                      </button>{' '}
                      to get started.
                    </span>
                  </td>
                </tr>
              ) : displayed.map(r => {
                const hrs = calcHours(r.check_in, r.check_out);
                return (
                  <tr key={r.id} style={r.status === 'half_day' ? { background: 'rgba(255,180,0,0.06)' } : undefined}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.resource_name}</td>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.record_date)}</td>
                    <td className="font-mono">{r.check_in  || '—'}</td>
                    <td className="font-mono">{r.check_out || '—'}</td>
                    <td className="font-mono" style={hrs?.short ? { color: 'var(--warning)', fontWeight: 600 } : undefined}>
                      {hrs ? hrs.label : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${STATUS_BADGE[r.status] || 'badge-neutral'}`}
                        style={{ fontSize: 10, textTransform: 'capitalize' }}
                      >
                        {(r.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-muted">{r.notes || '—'}</td>
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

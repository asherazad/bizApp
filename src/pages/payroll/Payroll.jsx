import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function currentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(my) {
  if (!my) return '';
  const [y, m] = my.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function monthSlug(my) {
  if (!my) return '';
  const [y, m] = my.split('-');
  const mn = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'long' });
  return `${mn}-${y}`;
}

const NUM_INPUT = {
  width: 90, textAlign: 'right', border: '1px solid var(--border)',
  borderRadius: 4, padding: '2px 6px', fontSize: 12,
  background: 'var(--surface)', color: 'var(--text)',
};

// ─── Monthly Run Tab ──────────────────────────────────────────────────────────
const STAFF_FILTERS = [
  { value: 'regular',   label: 'Regular Staff' },
  { value: '3rd_party', label: '3rd Party'     },
  { value: 'all',       label: 'All'            },
];

function is3rdParty(r) { return (r.employment_status || '').toLowerCase() === '3rd party'; }

// ─── Process Payroll Confirmation Modal ──────────────────────────────────────
function ProcessModal({ rows, monthYear, wingId, onClose, onDone, toast }) {
  const [accounts,      setAccounts]      = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentDate,   setPaymentDate]   = useState(new Date().toISOString().split('T')[0]);
  const [saving,        setSaving]        = useState(false);

  const totalNet = rows.reduce((s, r) => s + (parseFloat(r.net_salary) || 0), 0);

  useEffect(() => {
    api.get('/banks/accounts', { params: wingId ? { wing_id: wingId } : {} })
      .then(r => setAccounts(r.data))
      .catch(() => {});
  }, [wingId]);

  async function confirm() {
    if (!bankAccountId) { toast('Select a bank account to debit', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/payroll/batch', {
        wing_id: wingId || null,
        month_year: monthYear,
        bank_account_id: bankAccountId,
        payment_date: paymentDate,
        rows,
      });
      toast(data.message, 'success');
      onDone();
    } catch (err) {
      toast(err.response?.data?.detail || err.response?.data?.error || 'Failed to process payroll', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Confirm Payroll Processing</h3>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {/* Summary */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="text-muted" style={{ fontSize: 12 }}>Resources</span>
              <span style={{ fontWeight: 600 }}>{rows.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Total Net Payable</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--success)' }}>PKR {fmt(totalNet)}</span>
            </div>
          </div>

          {/* Resource breakdown */}
          <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 6 }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.resource_id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{i + 1}.</td>
                    <td style={{ padding: '6px 4px', fontWeight: 500 }}>{r.resource_name}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success)', fontWeight: 600 }}>
                      PKR {fmt(r.net_salary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bank account */}
          <div className="form-group">
            <label className="form-label">Debit from Bank Account *</label>
            <select className="form-control" required value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.bank_name} — {a.account_title} (PKR {fmt(a.current_balance)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Date</label>
            <input type="date" className="form-control" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={confirm} disabled={saving || !bankAccountId}>
              {saving ? 'Processing…' : `Process & Debit PKR ${fmt(totalNet)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunPayrollTab({ wings, activeWing, toast }) {
  const [monthYear,    setMonthYear]    = useState(currentMonthYear());
  const [wingId,       setWingId]       = useState(activeWing?.id || '');
  const [staffFilter,  setStaffFilter]  = useState('regular');
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [singleRow,    setSingleRow]    = useState(null);

  async function load() {
    if (!monthYear) return;
    setLoading(true);
    try {
      const { data } = await api.get('/payroll/preview', {
        params: { month_year: monthYear, ...(wingId ? { wing_id: wingId } : {}) },
      });
      setRows(data.map(r => ({ ...r })));
      setLoaded(true);
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to load preview', 'error');
    } finally { setLoading(false); }
  }

  // Filter rows by selected staff type (client-side — data already loaded)
  const displayRows = staffFilter === 'all'       ? rows
                    : staffFilter === '3rd_party'  ? rows.filter(is3rdParty)
                    : rows.filter(r => !is3rdParty(r));

  function updateRow(resourceId, field, val) {
    setRows(prev => prev.map(r => {
      if (r.resource_id !== resourceId) return r;
      const row = { ...r, [field]: val === '' ? 0 : parseFloat(val) || 0 };
      row.net_salary = Math.max(0,
        (row.gross_salary        || 0)
        + (row.overtime_amount   || 0)
        - (row.tax_deduction     || 0)
        - (row.loan_deduction    || 0)
        - (row.advance_deduction || 0)
        - (row.other_deductions  || 0)
      );
      return row;
    }));
  }

  const totalGross = displayRows.reduce((s, r) => s + (parseFloat(r.gross_salary)     || 0), 0);
  const totalTax   = displayRows.reduce((s, r) => s + (parseFloat(r.tax_deduction)    || 0), 0);
  const totalLoan  = displayRows.reduce((s, r) => s + (parseFloat(r.loan_deduction)   || 0), 0);
  const totalAdv   = displayRows.reduce((s, r) => s + (parseFloat(r.advance_deduction)|| 0), 0);
  const totalOther = displayRows.reduce((s, r) => s + (parseFloat(r.other_deductions) || 0), 0);
  const totalOT    = displayRows.reduce((s, r) => s + (parseFloat(r.overtime_amount)  || 0), 0);
  const totalNet   = displayRows.reduce((s, r) => s + (parseFloat(r.net_salary)       || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Month</label>
          <input type="month" className="form-control" value={monthYear}
            onChange={e => { setMonthYear(e.target.value); setLoaded(false); }} />
        </div>
        {wings.length > 1 && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Wing</label>
            <select className="form-control" value={wingId}
              onChange={e => { setWingId(e.target.value); setLoaded(false); }}>
              <option value="">All Wings</option>
              {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}
        {/* Staff type filter pills */}
        <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end', marginBottom: 1 }}>
          {STAFF_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStaffFilter(f.value)} style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              fontWeight: staffFilter === f.value ? 600 : 400,
              background: staffFilter === f.value ? 'var(--primary)' : 'var(--surface)',
              color: staffFilter === f.value ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${staffFilter === f.value ? 'var(--primary)' : 'var(--border)'}`,
            }}>{f.label}</button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Load Preview'}
        </button>
        {loaded && displayRows.length > 0 && (
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }}
            onClick={() => setShowConfirm(true)}>
            {`Process ${staffFilter === '3rd_party' ? '3rd Party' : staffFilter === 'all' ? 'All' : 'Regular'} — PKR ${fmt(totalNet)}`}
          </button>
        )}
      </div>

      {loaded && displayRows.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card electric">
            <div className="stat-label">Resources</div>
            <div className="stat-value">{displayRows.length}</div>
            <div className="stat-sub">{staffFilter === '3rd_party' ? '3rd party' : staffFilter === 'all' ? 'total' : 'regular staff'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Gross</div>
            <div className="stat-value" style={{ fontSize: 16 }}>PKR {fmt(totalGross)}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Total Deductions</div>
            <div className="stat-value" style={{ fontSize: 16 }}>PKR {fmt(totalTax + totalLoan + totalAdv + totalOther)}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Total Net Payable</div>
            <div className="stat-value" style={{ fontSize: 16 }}>PKR {fmt(totalNet)}</div>
          </div>
        </div>
      )}

      {loaded ? (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table" style={{ fontSize: 12, minWidth: 960 }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Resource</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Gross (PKR)</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
                <th style={{ textAlign: 'right' }}>Loan Ded.</th>
                <th style={{ textAlign: 'right' }}>Advance</th>
                <th style={{ textAlign: 'right' }}>Other Ded.</th>
                <th style={{ textAlign: 'right' }}>Overtime</th>
                <th style={{ textAlign: 'right' }}>Net Salary</th>
                <th style={{ width: 60 }}>Status</th>
                <th style={{ width: 72 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32 }} className="text-muted">
                  {loaded ? `No ${staffFilter === '3rd_party' ? '3rd party' : 'regular'} resources found.` : 'Click Load Preview.'}
                </td></tr>
              ) : displayRows.map((row, idx) => (
                <tr key={row.resource_id}>
                  <td className="text-muted">{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{row.resource_name}</div>
                    {row.designation && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.designation}</div>}
                  </td>
                  <td>
                    <span className={`badge ${is3rdParty(row) ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                      {row.employment_status || 'employee'}
                    </span>
                  </td>
                  {['gross_salary','tax_deduction','loan_deduction','advance_deduction','other_deductions','overtime_amount'].map(field => (
                    <td key={field} style={{ textAlign: 'right' }}>
                      <input type="number" min={0} style={NUM_INPUT}
                        value={row[field] || 0}
                        onChange={e => updateRow(row.resource_id, field, e.target.value)} />
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>
                    {fmt(row.net_salary)}
                  </td>
                  <td>
                    {row.status === 'paid'
                      ? <span className="badge badge-success" style={{ fontSize: 10 }}>Paid</span>
                      : <span className="badge badge-neutral" style={{ fontSize: 10 }}>Draft</span>}
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => {
                        if (row.status === 'paid' && !window.confirm(`${row.resource_name} has already been paid for this month. Re-processing will create a new bank debit. Continue?`)) return;
                        setSingleRow(row);
                      }}
                      title={row.status === 'paid' ? 'Re-process salary' : 'Process salary'}
                    >
                      {row.status === 'paid' ? 'Re-pay' : 'Pay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {displayRows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 12 }}>
                  <td colSpan={3}>Totals ({displayRows.length})</td>
                  <td style={{ textAlign: 'right' }}>{fmt(totalGross)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(totalTax)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(totalLoan)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(totalAdv)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(totalOther)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmt(totalOT)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>{fmt(totalNet)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p className="text-muted" style={{ marginBottom: 12 }}>
            Select a month and click <strong>Load Preview</strong> to prepare payroll.
          </p>
          <p className="text-muted" style={{ fontSize: 12 }}>
            Loan deductions are auto-filled from active loans. All fields are editable before processing.
          </p>
        </div>
      )}

      {showConfirm && (
        <ProcessModal
          rows={displayRows}
          monthYear={monthYear}
          wingId={wingId}
          onClose={() => setShowConfirm(false)}
          onDone={() => { setShowConfirm(false); load(); }}
          toast={toast}
        />
      )}
      {singleRow && (
        <ProcessModal
          rows={[singleRow]}
          monthYear={monthYear}
          wingId={wingId}
          onClose={() => setSingleRow(null)}
          onDone={() => { setSingleRow(null); load(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

// ─── Bank Letter Tab ──────────────────────────────────────────────────────────
function BankLetterTab({ wings, activeWing, toast }) {
  const [monthYear,    setMonthYear]    = useState(currentMonthYear());
  const [wingId,       setWingId]       = useState(activeWing?.id || '');
  const [selectedBank, setSelectedBank] = useState('');
  const [bankName,     setBankName]     = useState('');
  const [companyName,  setCompanyName]  = useState('Raheem Solutions (Pvt.) Ltd.');
  const [accountNo,    setAccountNo]    = useState('');
  const [chequeNo,     setChequeNo]     = useState('');
  const [allRows,      setAllRows]      = useState([]);
  const [loading,      setLoading]      = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/payroll/preview', {
        params: { month_year: monthYear, ...(wingId ? { wing_id: wingId } : {}) },
      });
      // Exclude 3rd party, keep rest for bank filtering
      const eligible = data.filter(r => (r.employment_status || '').toLowerCase() !== '3rd party');
      setAllRows(eligible);
      // Auto-select first bank if none chosen yet
      if (!selectedBank && eligible.length) {
        const firstBank = eligible.find(r => r.bank_name)?.bank_name || '';
        setSelectedBank(firstBank);
        setBankName(firstBank);
      }
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to load', 'error');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (monthYear) load(); }, [monthYear, wingId]);

  // Derive unique bank names from loaded resources
  const availableBanks = [...new Set(allRows.map(r => r.bank_name).filter(Boolean))].sort();

  // Filter to selected bank
  const rows = selectedBank
    ? allRows.filter(r => (r.bank_name || '').toLowerCase() === selectedBank.toLowerCase())
    : allRows;

  function handleBankSelect(e) {
    const val = e.target.value;
    setSelectedBank(val);
    setBankName(val); // pre-fill the formal bank name field
  }

  const total = rows.reduce((s, r) => s + (parseFloat(r.net_salary) || 0), 0);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  function printLetter() {
    const win = window.open('', '_blank', 'width=920,height=720');
    const tableRows = rows.map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}.</td>
        <td>${r.resource_name || ''}</td>
        <td style="font-family:monospace">${r.account_number || '—'}</td>
        <td style="text-align:right;font-family:monospace">${fmt(r.net_salary)}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Bank Letter — ${monthSlug(monthYear)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 0 60px 40px; line-height: 1.7; }
  .letterhead-space { height: 130px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 28px; }
  .subject-block { margin: 20px 0 16px; }
  p { margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #1a1a4e; color: #fff; padding: 9px 12px; text-align: left; border: 1px solid #333; }
  td { border: 1px solid #aaa; padding: 7px 12px; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .total-row td { font-weight: 700; border-top: 2px solid #333; background: #ececec; }
  .sig { margin-top: 56px; }
  .sig-line { margin-top: 48px; border-top: 1px solid #333; width: 180px; padding-top: 4px; font-size: 12px; }
  @media print { body { padding: 0 40px 20px; } }
</style></head><body>
<div class="letterhead-space"></div>
<div class="header">
  <div>
    <div>To,</div>
    <div style="margin-top:10px"><strong>The Bank Manager</strong></div>
    <div>${bankName || selectedBank}</div>
  </div>
  <div style="text-align:right">Date: ${today}</div>
</div>

<div class="subject-block">
  <strong>Subject:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <strong><u>Salaries transfer for the month of ${monthSlug(monthYear)}</u></strong>
</div>

<p>You are requested to transfer the amount <strong>Rs. ${fmt(total)}/=</strong> from our company account
"${companyName}${accountNo ? ` account no. <strong>${accountNo}</strong>` : ''}"
by cheque number "${chequeNo || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}"
against staff salaries as per list.</p>

<table>
  <thead>
    <tr>
      <th style="width:60px;text-align:center">Sr. No</th>
      <th>Bank Account Title</th>
      <th>Account Number</th>
      <th style="text-align:right">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    <tr class="total-row">
      <td colspan="3">Total</td>
      <td style="text-align:right;font-family:monospace">${fmt(total)}</td>
    </tr>
  </tbody>
</table>

<div class="sig">
  <div class="sig-line">Authorized Signature</div>
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 350);
  }

  return (
    <div>
      {/* Controls row 1 — month / wing / bank filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Month</label>
          <input type="month" className="form-control" value={monthYear} onChange={e => setMonthYear(e.target.value)} />
        </div>
        {wings.length > 1 && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Wing</label>
            <select className="form-control" value={wingId} onChange={e => setWingId(e.target.value)}>
              <option value="">All Wings</option>
              {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Filter by Bank *</label>
          <select className="form-control" style={{ width: 220 }} value={selectedBank} onChange={handleBankSelect}>
            <option value="">— All Banks —</option>
            {availableBanks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        {selectedBank && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', paddingBottom: 4 }}>
            {rows.length} resource{rows.length !== 1 ? 's' : ''} · Rs. {fmt(total)}
          </div>
        )}
      </div>

      {/* Controls row 2 — letter details */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Bank Name (in letter)</label>
          <input className="form-control" style={{ width: 220 }} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Meezan Bank Limited" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Company Name</label>
          <input className="form-control" style={{ width: 260 }} value={companyName} onChange={e => setCompanyName(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Company Account No.</label>
          <input className="form-control" style={{ width: 160 }} value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="e.g. 0236-0104617311" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Cheque No.</label>
          <input className="form-control" style={{ width: 120 }} value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="Optional" />
        </div>
        <button className="btn btn-primary" onClick={printLetter} disabled={!rows.length || loading}>
          Print Letter
        </button>
      </div>

      {/* Preview table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {monthLabel(monthYear)}
            {selectedBank ? ` · ${selectedBank}` : ' · All Banks'}
            {' '}· {rows.length} transfers (3rd party excluded)
          </span>
          <span style={{ fontWeight: 700, color: 'var(--success)' }}>Rs. {fmt(total)}</span>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 48 }}>Sr.</th>
                <th>Bank Account Title</th>
                <th>Account Number</th>
                <th>Bank</th>
                <th style={{ textAlign: 'right' }}>Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }} className="text-muted">
                  {allRows.length > 0
                    ? 'No resources match the selected bank filter.'
                    : 'No resources found. Make sure resources have salaries set in the Resources module.'}
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.resource_id}>
                  <td className="text-muted">{i + 1}.</td>
                  <td style={{ fontWeight: 500 }}>{r.resource_name}</td>
                  <td className="font-mono">{r.account_number || <span className="text-muted">—</span>}</td>
                  <td className="text-muted">{r.bank_name || '—'}</td>
                  <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.net_salary)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={4}>Total ({rows.length} transfers)</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{fmt(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Reverse Payroll Modal ────────────────────────────────────────────────────
function ReverseModal({ run, onClose, onDone, toast }) {
  const [accounts,      setAccounts]      = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    api.get('/banks/accounts').then(r => setAccounts(r.data)).catch(() => {});
  }, []);

  async function confirm() {
    setSaving(true);
    try {
      const { data } = await api.post(`/payroll/${run.id}/reverse`, {
        bank_account_id: bankAccountId || undefined,
      });
      toast(data.message + (bankAccountId ? ` — PKR ${fmt(run.net_salary)} credited back` : ''), 'success');
      onDone();
    } catch (err) {
      toast(err.response?.data?.detail || err.response?.data?.error || 'Reversal failed', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Reverse Payroll</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{run.resource_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{monthLabel(run.month_year)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted" style={{ fontSize: 12 }}>Net Salary</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>PKR {fmt(run.net_salary)}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Credit back to Bank Account <span className="text-muted" style={{ fontSize: 11 }}>(optional)</span></label>
            <select className="form-control" value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
              <option value="">— No bank credit —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.bank_name} — {a.account_title} (PKR {fmt(a.current_balance)})
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            This will mark the salary as <strong>Reversed</strong> and optionally add a credit transaction to the selected account.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-danger" onClick={confirm} disabled={saving}>
              {saving ? 'Reversing…' : 'Confirm Reversal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ wings, toast }) {
  const [monthYear,     setMonthYear]     = useState(currentMonthYear());
  const [wingId,        setWingId]        = useState('');
  const [staffFilter,   setStaffFilter]   = useState('regular');
  const [runs,          setRuns]          = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [reverseTarget, setReverseTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/payroll', {
        params: { month_year: monthYear, ...(wingId ? { wing_id: wingId } : {}) },
      });
      setRuns(data);
    } catch { toast('Failed to load history', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (monthYear) load(); }, [monthYear, wingId]);

  const displayRuns = staffFilter === 'all'       ? runs
                    : staffFilter === '3rd_party'  ? runs.filter(is3rdParty)
                    : runs.filter(r => !is3rdParty(r));

  const totalNet   = displayRuns.reduce((s, r) => s + (parseFloat(r.net_salary)  || 0), 0);
  const totalGross = displayRuns.reduce((s, r) => s + (parseFloat(r.gross_salary || r.basic_earned) || 0), 0);
  const totalDed   = displayRuns.reduce((s, r) =>
    s + (parseFloat(r.tax_deduction)||0) + (parseFloat(r.loan_deduction)||0)
      + (parseFloat(r.advance_deduction)||0) + (parseFloat(r.other_deductions)||0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Month</label>
          <input type="month" className="form-control" value={monthYear} onChange={e => setMonthYear(e.target.value)} />
        </div>
        {wings.length > 1 && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Wing</label>
            <select className="form-control" value={wingId} onChange={e => setWingId(e.target.value)}>
              <option value="">All Wings</option>
              {wings.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end', marginBottom: 1 }}>
          {STAFF_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStaffFilter(f.value)} style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              fontWeight: staffFilter === f.value ? 600 : 400,
              background: staffFilter === f.value ? 'var(--primary)' : 'var(--surface)',
              color: staffFilter === f.value ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${staffFilter === f.value ? 'var(--primary)' : 'var(--border)'}`,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {displayRuns.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card electric">
            <div className="stat-label">Payroll Records</div>
            <div className="stat-value">{displayRuns.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Gross</div>
            <div className="stat-value" style={{ fontSize: 16 }}>PKR {fmt(totalGross)}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Total Deductions</div>
            <div className="stat-value" style={{ fontSize: 16 }}>PKR {fmt(totalDed)}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Total Net Paid</div>
            <div className="stat-value" style={{ fontSize: 16 }}>PKR {fmt(totalNet)}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{monthLabel(monthYear)} — {displayRuns.length} records</span>
          {displayRuns.length > 0 && <span style={{ fontWeight: 700, color: 'var(--success)' }}>Net: PKR {fmt(totalNet)}</span>}
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Resource</th>
                <th>Wing</th>
                <th style={{ textAlign: 'right' }}>Gross</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
                <th style={{ textAlign: 'right' }}>Loan Ded.</th>
                <th style={{ textAlign: 'right' }}>Advance</th>
                <th style={{ textAlign: 'right' }}>Other</th>
                <th style={{ textAlign: 'right' }}>Overtime</th>
                <th style={{ textAlign: 'right' }}>Net Salary</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 32 }} className="text-muted">Loading…</td></tr>
              ) : displayRuns.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 48 }} className="text-muted">
                  No {staffFilter === '3rd_party' ? '3rd party' : staffFilter === 'all' ? '' : 'regular'} payroll records for {monthLabel(monthYear)}.
                  Use the <strong>Monthly Run</strong> tab to generate.
                </td></tr>
              ) : displayRuns.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{r.resource_name}</td>
                  <td className="text-muted">{r.wing_name || '—'}</td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(r.gross_salary || r.basic_earned)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(r.tax_deduction)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(r.loan_deduction)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(r.advance_deduction)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{fmt(r.other_deductions)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmt(r.overtime_amount)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmt(r.net_salary)}</td>
                  <td>
                    {(() => {
                      const s = (r.status || '').toLowerCase();
                      return (
                        <span className={`badge ${s === 'paid' ? 'badge-success' : s === 'reversed' ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                          {r.status || 'draft'}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {(r.status || '').toLowerCase() === 'paid' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger, #dc3545)' }}
                        onClick={() => {
                          if (!window.confirm(`Reverse salary payment for ${r.resource_name}? This will mark it as Reversed and optionally credit the bank account.`)) return;
                          setReverseTarget(r);
                        }}
                        title="Reverse this salary payment"
                      >
                        Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {displayRuns.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={3}>Totals ({displayRuns.length})</td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(totalGross)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>
                    {fmt(displayRuns.reduce((s,r) => s+(parseFloat(r.tax_deduction)||0),0))}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>
                    {fmt(displayRuns.reduce((s,r) => s+(parseFloat(r.loan_deduction)||0),0))}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>
                    {fmt(displayRuns.reduce((s,r) => s+(parseFloat(r.advance_deduction)||0),0))}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>
                    {fmt(displayRuns.reduce((s,r) => s+(parseFloat(r.other_deductions)||0),0))}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--primary)' }}>
                    {fmt(displayRuns.reduce((s,r) => s+(parseFloat(r.overtime_amount)||0),0))}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{fmt(totalNet)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {reverseTarget && (
        <ReverseModal
          run={reverseTarget}
          onClose={() => setReverseTarget(null)}
          onDone={() => { setReverseTarget(null); load(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Payroll() {
  const { wings, activeWing } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('run');

  const tabStyle = (t) => ({
    padding: '8px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
    background: 'none', border: 'none',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    cursor: 'pointer', marginBottom: -1,
  });

  return (
    <div>
      <div className="page-header">
        <h1>Payroll & Salary</h1>
        {activeWing && <span className="badge badge-navy">{activeWing.name}</span>}
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <button style={tabStyle('run')}     onClick={() => setTab('run')}>Monthly Run</button>
        <button style={tabStyle('letter')}  onClick={() => setTab('letter')}>Bank Letter</button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'run'     && <RunPayrollTab  wings={wings || []} activeWing={activeWing} toast={toast} />}
      {tab === 'letter'  && <BankLetterTab  wings={wings || []} activeWing={activeWing} toast={toast} />}
      {tab === 'history' && <HistoryTab     wings={wings || []} toast={toast} />}
    </div>
  );
}

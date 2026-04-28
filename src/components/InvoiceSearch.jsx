import { useState, useEffect, useRef } from 'react';
import { Search, FileText, X } from 'lucide-react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/format';
import InvoiceDetail from '../pages/invoices/InvoiceDetail';
import InvoiceFileViewer from './InvoiceFileViewer';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function InvoiceSearch({ wings }) {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null);
  const inputRef                = useRef(null);
  const containerRef            = useRef(null);
  const debouncedQuery          = useDebounce(query, 300);

  // Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setResults([]); }
  }, [open]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    setLoading(true);
    api.get('/invoices', { params: { search: debouncedQuery, limit: 8 } })
      .then(r => setResults(r.data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Click outside
  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const STATUS_STYLES = {
    Received: { bg: 'var(--success-light)', color: 'var(--success-text)', dot: 'var(--success)' },
    Paid:     { bg: 'var(--success-light)', color: 'var(--success-text)', dot: 'var(--success)' },
    Overdue:  { bg: 'var(--danger-light)',  color: 'var(--danger-text)',  dot: 'var(--danger)' },
    Disputed: { bg: 'var(--warning-light)', color: 'var(--warning-text)', dot: 'var(--warning)' },
    Pending:  { bg: 'var(--warning-light)', color: 'var(--warning-text)', dot: 'var(--warning)' },
  };

  function statusStyle(status) {
    return STATUS_STYLES[status] || { bg: 'var(--surface-3)', color: 'var(--ink-3)', dot: 'var(--ink-4)' };
  }

  return (
    <>
      {/* Pill search bar trigger (topbar inline style) */}
      <div
        className="search-bar-trigger"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{ cursor: 'text' }}
      >
        <Search size={14} color="var(--ink-3)" style={{ flexShrink: 0 }}/>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-3)' }}>Search invoices…</span>
        <kbd style={{ fontSize: 10, color: 'var(--ink-4)', background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '2px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>⌘K</kbd>
      </div>

      {/* Full search overlay */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'var(--overlay)',
          backdropFilter: 'blur(2px)',
          zIndex: 10000,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: 80,
          animation: 'fadeIn 0.15s ease',
        }}>
          <div
            ref={containerRef}
            style={{
              width: '100%', maxWidth: 560,
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border-md)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              margin: '0 16px',
              animation: 'slideInUp 0.2s ease',
            }}
          >
            {/* Input row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: results.length || (query && !loading) ? '1px solid var(--border)' : 'none' }}>
              <Search size={16} color="var(--ink-3)" style={{ flexShrink: 0 }}/>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search invoices by number, vendor, client, PO…"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}
              />
              {loading && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Searching…</span>}
              {!loading && query && (
                <button onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                  <X size={14} color="var(--ink-3)"/>
                </button>
              )}
              <kbd style={{ fontSize: 11, color: 'var(--ink-4)', background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>Esc</kbd>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {results.map(inv => {
                  const ss = statusStyle(inv.status);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => { setSelected(inv.id); setOpen(false); setQuery(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background var(--t)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <FileText size={15} color={inv.has_file ? 'var(--electric)' : 'var(--ink-4)'} style={{ flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, fontFamily: 'var(--font-mono)', color: 'var(--electric)' }}>
                          #{inv.invoice_number}
                          {inv.vendor_name && <span style={{ fontWeight: 400, color: 'var(--ink-2)', fontFamily: 'var(--font-body)', marginLeft: 8, fontSize: 13 }}>{inv.vendor_name}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>
                          {inv.client_name && <span>{inv.client_name} · </span>}
                          {formatDate(inv.invoice_date)}
                          {inv.wing_name && <span> · {inv.wing_name}</span>}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)' }}>{formatCurrency(inv.total_amount, inv.currency)}</div>
                        <div style={{ marginTop: 3 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: ss.dot, display: 'inline-block' }}/>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                      {inv.has_file && (
                        <div onClick={e => e.stopPropagation()}>
                          <InvoiceFileViewer invoiceId={inv.id} fileName={inv.source_file_name} fileType={inv.source_file_type} fileSize={inv.source_file_size} trigger="icon"/>
                        </div>
                      )}
                    </div>
                  );
                })}
                {results.length >= 8 && (
                  <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center', background: 'var(--surface-2)' }}>
                    Showing top 8 — refine your search for more specific results
                  </div>
                )}
              </div>
            )}

            {query && !loading && results.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
                No invoices found for "<strong>{query}</strong>"
              </div>
            )}

            {!query && (
              <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>
                Search by invoice number, vendor, client name, or PO reference
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice detail from search result */}
      {selected && (
        <InvoiceDetail invoiceId={selected} wings={wings || []} onClose={() => setSelected(null)} onRefresh={() => {}}/>
      )}
    </>
  );
}

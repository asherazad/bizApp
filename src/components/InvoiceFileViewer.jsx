import { useState, useEffect } from 'react';
import { X, Download, FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import api from '../lib/api';

const SIZE_WARNING_BYTES = 10 * 1024 * 1024;

function humanSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SlideOver({ invoiceId, fileName, fileType, fileSize, onClose }) {
  const [signedUrl, setSignedUrl]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [pdfError, setPdfError]     = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/invoices/${invoiceId}/file`)
      .then(r => setSignedUrl(r.data.signed_url))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const isPDF   = fileType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf');
  const isImage = /^image\//.test(fileType || '');
  const isLarge = fileSize && fileSize > SIZE_WARNING_BYTES;

  function download() {
    if (!signedUrl) return;
    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = fileName || 'invoice';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--overlay-light)',
          backdropFilter: 'blur(2px)',
          zIndex: 500,
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'clamp(360px, 50vw, 900px)',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border-md)',
        zIndex: 501,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          height: 52, flexShrink: 0,
          padding: '0 var(--sp-5)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm btn-icon"
            style={{ flexShrink: 0 }}
          >
            <X size={14}/>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || 'Invoice Document'}
            </div>
            {fileSize && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{humanSize(fileSize)}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {signedUrl && (
              <button className="btn btn-secondary btn-sm" onClick={download}>
                <Download size={13}/> Download
              </button>
            )}
            {signedUrl && (
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm btn-icon">
                <ExternalLink size={13}/>
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface-2)', position: 'relative' }}>
          {loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
              Loading document…
            </div>
          )}

          {!loading && fetchError && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
              <AlertTriangle size={32} color="var(--danger)"/>
              <div style={{ fontWeight: 600, color: 'var(--danger)', fontFamily: 'var(--font-display)' }}>Could not load document</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>The file may have been removed or the link expired.<br/>Try closing and reopening.</div>
            </div>
          )}

          {!loading && signedUrl && (
            <>
              {isLarge && (
                <div style={{ padding: '8px 16px', background: 'var(--warning-light)', borderBottom: '1px solid var(--warning-border)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={13} color="var(--warning-text)"/>
                  <span style={{ color: 'var(--warning-text)' }}>Large file ({humanSize(fileSize)}) — use Download for best experience.</span>
                </div>
              )}

              {isPDF && !pdfError && (
                <iframe
                  src={signedUrl}
                  title={fileName}
                  style={{ flex: 1, border: 'none', width: '100%' }}
                  onError={() => setPdfError(true)}
                />
              )}

              {isPDF && pdfError && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
                  <FileText size={40} color="var(--ink-4)"/>
                  <div style={{ fontSize: 14, color: 'var(--ink-3)', textAlign: 'center' }}>
                    PDF preview unavailable in this browser.<br/>Use the Download button instead.
                  </div>
                  <button className="btn btn-primary" onClick={download}><Download size={14}/> Download PDF</button>
                </div>
              )}

              {isImage && (
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
                  <img src={signedUrl} alt={fileName} style={{ maxWidth: '100%', borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-sm)' }}/>
                </div>
              )}

              {!isPDF && !isImage && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
                  <FileText size={40} color="var(--ink-4)"/>
                  <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>Preview not available for this file type.</div>
                  <button className="btn btn-primary" onClick={download}><Download size={14}/> Download File</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function InvoiceFileViewer({ invoiceId, fileName, fileType, fileSize, trigger = 'icon', disabled }) {
  const [open, setOpen] = useState(false);
  if (!invoiceId) return null;

  const triggerEl = (() => {
    if (trigger === 'button') return (
      <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setOpen(true); }} disabled={disabled}>
        <FileText size={13}/> View File
      </button>
    );
    if (trigger === 'thumbnail') return (
      <div
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--electric-light)', border: '1px solid var(--electric-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all var(--t)' }}
      >
        <FileText size={16} color="var(--electric)"/>
      </div>
    );
    return (
      <button
        className="btn btn-secondary btn-sm btn-icon"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        disabled={disabled}
        title={fileName || 'View invoice file'}
        style={{ color: 'var(--electric)' }}
      >
        <FileText size={14}/>
      </button>
    );
  })();

  return (
    <>
      {triggerEl}
      {open && (
        <SlideOver invoiceId={invoiceId} fileName={fileName} fileType={fileType} fileSize={fileSize} onClose={() => setOpen(false)}/>
      )}
    </>
  );
}

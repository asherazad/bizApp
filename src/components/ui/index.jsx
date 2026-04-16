import { initials } from '../../lib/format'

// ─── Modal ───────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, width = 480 }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: 'var(--blue-50)',   text: 'var(--blue-800)'   },
  { bg: 'var(--teal-50)',   text: 'var(--teal-800)'   },
  { bg: 'var(--purple-50)', text: 'var(--purple-800)' },
  { bg: 'var(--amber-50)',  text: 'var(--amber-800)'  },
  { bg: 'var(--coral-50)',  text: 'var(--coral-600)'  },
]

export function Avatar({ name = '', size = 32 }) {
  const idx   = name.charCodeAt(0) % AVATAR_COLORS.length
  const color = AVATAR_COLORS[idx]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color.bg, color: color.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 500,
    }}>
      {initials(name)}
    </div>
  )
}

// ─── StatusPill ──────────────────────────────────────────
const STATUS_MAP = {
  paid:      'pill-green',
  active:    'pill-green',
  approved:  'pill-green',
  pending:   'pill-amber',
  overdue:   'pill-red',
  cancelled: 'pill-gray',
  inactive:  'pill-gray',
  draft:     'pill-gray',
  rejected:  'pill-red',
}

export function StatusPill({ status }) {
  const cls = STATUS_MAP[status?.toLowerCase()] ?? 'pill-gray'
  return <span className={`pill ${cls}`}>{status}</span>
}

// ─── EmptyState ──────────────────────────────────────────
export function EmptyState({ icon, title = 'Nothing here yet', message, action }) {
  return (
    <div className="empty-state">
      {icon && <div style={{ fontSize: 24, opacity: .35 }}>{icon}</div>}
      <p style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</p>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

// ─── Spinner ─────────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return (
    <div className="spinner" style={{ width: size, height: size }} />
  )
}

// ─── Section header ──────────────────────────────────────
export function SectionHeader({ title, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
      <div style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.04em' }}>{title}</div>
      {action}
    </div>
  )
}

// ─── Stat delta ──────────────────────────────────────────
export function Delta({ value, suffix = '%' }) {
  const cls    = value > 0 ? 'delta-up' : value < 0 ? 'delta-down' : 'delta-flat'
  const prefix = value > 0 ? '+' : ''
  return (
    <span className={`kpi-delta ${cls}`}>
      {prefix}{value}{suffix} vs last month
    </span>
  )
}

// ─── Confirm dialog ──────────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel}
        </button>
      </>
    }>
      <p style={{ fontSize:13, color:'var(--text-secondary)' }}>{message}</p>
    </Modal>
  )
}

// ─── Search input ─────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…', style }) {
  return (
    <div style={{ position:'relative', ...style }}>
      <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-tertiary)', pointerEvents:'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        className="input input-sm"
        style={{ paddingLeft: 28 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

import { useAuth } from '../context/AuthContext';
import InvoiceSearch from './InvoiceSearch';

export default function Topbar({ title }) {
  const { wings, activeWing, setActiveWing } = useAuth();

  return (
    <header className="topbar">
      {/* Left: page title */}
      <span className="topbar-title">{title}</span>

      {/* Center: global search */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
        <InvoiceSearch wings={wings}/>
      </div>

      {/* Right: wing selector */}
      <div className="topbar-right">
        {wings.length > 1 ? (
          <select
            className="wing-selector"
            value={activeWing?.id || ''}
            onChange={(e) => {
              const w = wings.find((w) => w.id === e.target.value);
              setActiveWing(w || null);
            }}
          >
            <option value="">All Wings</option>
            {wings.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        ) : wings.length === 1 ? (
          <div style={{
            height: 32, padding: '0 12px',
            background: 'var(--electric-light)',
            border: '1px solid var(--electric-ring)',
            borderRadius: 'var(--r)',
            fontSize: 12.5, fontWeight: 600, color: 'var(--electric)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block' }}/>
            {wings[0].name}
          </div>
        ) : null}
      </div>
    </header>
  );
}

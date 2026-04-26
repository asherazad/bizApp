import { useAuth } from '../context/AuthContext';

export default function Topbar({ title }) {
  const { wings, activeWing, setActiveWing } = useAuth();

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-right">
        {wings.length > 1 && (
          <select
            className="form-control wing-selector"
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
        )}
      </div>
    </header>
  );
}

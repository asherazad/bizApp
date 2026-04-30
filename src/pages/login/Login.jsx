import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }  = useAuth();
  const toast      = useToast();
  const navigate   = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      toast(err.response?.data?.error || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--ink) 0%, var(--ink-navy) 60%, var(--ink-indigo) 100%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center'}}>
          <img src="/sync-logo.svg" alt="SYNC" style={{ width: 225, marginBottom: 20 }} />
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border-md)',
            padding: '28px 28px 24px',
          }}
        >
          <h2 style={{ marginBottom: 20, fontFamily: 'var(--font-display)' }}>Sign In</h2>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              required
              placeholder="admin@nexus.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 22 }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" style={{ height: 42 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

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
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #152b47 0%, #1e3a5f 60%, #2a4f7e 100%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none" style={{ marginBottom: 12 }}>
            <rect width="32" height="32" rx="8" fill="rgba(255,255,255,.1)"/>
            <path d="M8 8h4l8 16h-4L8 8zm8 0h4l-8 16h-4l8-16z" fill="#f59e0b"/>
          </svg>
          <h1 style={{ color: '#fff', fontSize: '1.75rem', letterSpacing: '-.5px' }}>
            Ne<span style={{ color: '#f59e0b' }}>xus</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,.55)', marginTop: 4, fontSize: 13 }}>
            Business Operations Platform
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="card" style={{ padding: 28 }}>
          <h2 style={{ marginBottom: 20, color: 'var(--text)' }}>Sign In</h2>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Email</label>
            <input
              type="email" className="form-control" required
              placeholder="admin@nexus.local"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Password</label>
            <input
              type="password" className="form-control" required
              placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './Login.module.css'

export default function Login() {
  const { login, demoLogin } = useAuth()
  const navigate             = useNavigate()
  const [email, setEmail]    = useState('ali@acme.com')
  const [password, setPass]  = useState('password')
  const [loading, setLoading]= useState(false)
  const [error, setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    // Simulate API call — replace with real api.post('/auth/login', { email, password })
    await new Promise(r => setTimeout(r, 600))
    if (email && password) {
      demoLogin()
      navigate('/')
    } else {
      setError('Invalid email or password.')
    }
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>B</div>
          <span className={styles.logoText}>BizPortal</span>
        </div>

        <div className={styles.heading}>
          <h1>Sign in</h1>
          <p>Enter your credentials to access your portal</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="field">
            <label className="label">Email address</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width:'100%' }}>
            {loading ? <><div className="spinner" style={{ borderTopColor:'#fff', borderColor:'rgba(255,255,255,.3)' }} /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <div className={styles.dividerRow}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine} />
        </div>

        <button className="btn btn-secondary" style={{ width:'100%' }} onClick={() => { demoLogin(); navigate('/') }}>
          Continue with demo account
        </button>

        <p className={styles.hint}>Demo: ali@acme.com · any password</p>
      </div>
    </div>
  )
}

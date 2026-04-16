import { createContext, useContext, useEffect, useState } from 'react'
import { mockTenant } from '../lib/mockData'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [tenant, setTenant]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production: fetch('/api/tenant/me').then(...)
    // Using mock data for now
    setTimeout(() => {
      setTenant(mockTenant)
      setLoading(false)
    }, 300)
  }, [])

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', gap:10 }}>
        <div className="spinner" />
        <span style={{ color:'var(--text-secondary)', fontSize:13 }}>Loading portal…</span>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <p style={{ color:'var(--text-secondary)' }}>Tenant not found.</p>
      </div>
    )
  }

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)

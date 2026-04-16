import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// Demo user seeded with admin permissions
const DEMO_USER = {
  id: 'user-001',
  full_name: 'Ali Ahmed',
  email: 'ali@acme.com',
  department_id: 'dept-001',
  role_ids: ['role-001'],
  permissions: { '*': ['*'] },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('bp_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  function login(userData, token) {
    localStorage.setItem('token',   token)
    localStorage.setItem('bp_user', JSON.stringify(userData))
    setUser(userData)
  }

  function demoLogin() {
    login(DEMO_USER, 'demo-token-xyz')
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('bp_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

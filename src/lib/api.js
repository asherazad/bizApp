import axios from 'axios'

/**
 * Axios instance.
 * - Dev:  /api proxied to localhost:4000 by Vite
 * - Prod: /api served directly by Vercel serverless function
 *
 * VITE_API_BASE_URL is optional — defaults to /api which works
 * in both Vite proxy (dev) and Vercel (prod) setups.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global 401 → redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('bp_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

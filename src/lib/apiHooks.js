/**
 * apiHooks.js
 * React hooks that talk to the Express backend.
 * All hooks handle loading, error, and data states.
 */
import { useState, useEffect, useCallback } from 'react'
import api from './api'

// ─── Generic fetch hook ───────────────────────────────────
export function useFetch(url, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    if (!url) return
    setLoading(true); setError(null)
    try {
      const res = await api.get(url)
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.error ?? e.message)
    } finally {
      setLoading(false)
    }
  }, [url, ...deps])  // eslint-disable-line

  useEffect(() => { load() }, [load])
  return { data, loading, error, refetch: load }
}

// ─── Clients ──────────────────────────────────────────────
export function useClients(search = '') {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.get('/clients', { params: { search, limit: 200 } })
      setClients(res.data.data ?? res.data)
    } catch (e) {
      setError(e.response?.data?.error ?? e.message)
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  async function createClient(data) {
    const res = await api.post('/clients', data)
    setClients(prev => [...prev, res.data].sort((a,b) => a.name.localeCompare(b.name)))
    return res.data
  }

  async function updateClient(id, data) {
    const res = await api.put(`/clients/${id}`, data)
    setClients(prev => prev.map(c => c.id === id ? res.data : c))
    return res.data
  }

  async function deleteClient(id) {
    await api.delete(`/clients/${id}`)
    setClients(prev => prev.filter(c => c.id !== id))
  }

  return { clients, loading, error, refetch: load, createClient, updateClient, deleteClient }
}

// ─── Invoices ─────────────────────────────────────────────
export function useInvoices(filters = {}) {
  const [invoices, setInvoices] = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const params = { type:'invoice', ...filters }
  const key    = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.get('/invoices', { params })
      setInvoices(res.data.data ?? [])
      setTotal(res.data.total ?? 0)
    } catch (e) {
      setError(e.response?.data?.error ?? e.message)
    } finally { setLoading(false) }
  }, [key])   // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function createInvoice(data) {
    const res = await api.post('/invoices', data)
    setInvoices(prev => [res.data, ...prev])
    return res.data
  }

  async function deleteInvoice(id) {
    await api.delete(`/invoices/${id}`)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status:'cancelled' } : i))
  }

  async function sendInvoice(id) {
    const res = await api.post(`/invoices/${id}/send`)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status:'sent' } : i))
    return res.data
  }

  return { invoices, total, loading, error, refetch: load, createInvoice, deleteInvoice, sendInvoice }
}

// Currency
export function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Short number: 84200 → $84.2k
export function formatShort(value) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`
  if (Math.abs(value) >= 1_000)     return `$${(value / 1_000).toFixed(1)}k`
  return `$${value}`
}

// Date
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dateStr))
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr))
}

// Relative time
export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return formatDateShort(dateStr)
}

// Delta display
export function deltaClass(value) {
  if (value > 0) return 'delta-up'
  if (value < 0) return 'delta-down'
  return 'delta-flat'
}

export function deltaPrefix(value) {
  return value > 0 ? '+' : ''
}

// Initials from full name
export function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// Clamp a number
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

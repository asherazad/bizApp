const CURRENCY_SYMBOLS = { PKR: '₨', USD: '$', EUR: '€', AED: 'د.إ', GBP: '£' };

export function formatCurrency(amount, currency = 'PKR') {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const n = parseFloat(amount) || 0;
  return `${symbol} ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatStatus(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusBadgeClass(status) {
  const map = {
    paid: 'badge-success', fully_paid: 'badge-success', active: 'badge-success',
    settled: 'badge-success', approved: 'badge-success', present: 'badge-success',
    overdue: 'badge-danger', cancelled: 'badge-danger', rejected: 'badge-danger',
    absent: 'badge-danger', terminated: 'badge-danger',
    pending: 'badge-warning', draft: 'badge-warning', partially_paid: 'badge-warning',
    sent: 'badge-info', acknowledged: 'badge-info', finalized: 'badge-info',
  };
  return map[status] || 'badge-neutral';
}

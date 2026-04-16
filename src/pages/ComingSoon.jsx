import Topbar from '../components/sidebar/Topbar'

const MODULE_ICONS = {
  Invoicing:         '🧾',
  Expenses:          '💸',
  'Bill payments':   '🏦',
  Subscriptions:     '🔄',
  'Purchase orders': '📦',
  Inventory:         '🗄️',
  'Resources (HR)':  '👥',
  Forecasting:       '📈',
  'Reports & P&L':   '📊',
}

export default function ComingSoon({ title }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>
      <Topbar title={title} />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center', maxWidth:380 }}>
          <div style={{ fontSize:40, marginBottom:16 }}>{MODULE_ICONS[title] ?? '🔧'}</div>
          <h2 style={{ fontSize:18, fontWeight:500, marginBottom:8 }}>{title}</h2>
          <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>
            This module is part of Sprint 2. The foundation layer (multi-tenant core, auth, dashboard)
            is live. Full {title.toLowerCase()} functionality is coming next.
          </p>
          <div style={{ marginTop:20, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            {['CRUD screens','Dept P&L feed','Approval workflow','Export to PDF/CSV'].map(f => (
              <span key={f} className="pill pill-gray">{f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

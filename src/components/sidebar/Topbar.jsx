import { useDept } from '../../context/DeptContext'
import { mockDepartments } from '../../lib/mockData'
import styles from './Topbar.module.css'

export default function Topbar({ title, subtitle, actions }) {
  const { activeDept, setActiveDept } = useDept()

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>

      <div className={styles.right}>
        {/* Dept switcher */}
        <div className={styles.deptTabs}>
          <button
            className={`${styles.deptTab} ${!activeDept ? styles.active : ''}`}
            onClick={() => setActiveDept(null)}
          >
            All
          </button>
          {mockDepartments.map(d => (
            <button
              key={d.id}
              className={`${styles.deptTab} ${activeDept?.id === d.id ? styles.active : ''}`}
              onClick={() => setActiveDept(d)}
            >
              {d.code}
            </button>
          ))}
        </div>

        {/* Extra action buttons passed from page */}
        {actions && <div className={styles.actions}>{actions}</div>}

        {/* Notifications bell */}
        <button className="btn btn-ghost btn-icon btn-sm" title="Notifications">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
